package com.shoopefood.mobile.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentManager;
import androidx.fragment.app.FragmentTransaction;

import com.google.android.material.badge.BadgeDrawable;
import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.shoopefood.mobile.R;
import com.shoopefood.mobile.cart.CartManager;
import com.shoopefood.mobile.databinding.ActivityHomeBinding;
import com.shoopefood.mobile.session.SessionManager;
import com.shoopefood.mobile.util.RoleRouter;

public class HomeActivity extends AppCompatActivity implements CustomerHomeHost {

    public static final String EXTRA_INITIAL_TAB = "initial_tab";
    public static final String TAB_HOME = "home";
    public static final String TAB_ORDERS = "orders";
    public static final String TAB_CART = "cart";
    public static final String TAB_PARTNER = "partner";
    public static final String TAB_PROFILE = "profile";

    private static final String TAG_HOME = "customer_home";
    private static final String TAG_ORDERS = "customer_orders";
    private static final String TAG_CART = "customer_cart";
    private static final String TAG_PARTNER = "customer_partner";
    private static final String TAG_PROFILE = "customer_profile";
    private static final String[] ALL_PAGE_TAGS = {
            TAG_PROFILE, TAG_HOME, TAG_ORDERS, TAG_PARTNER, TAG_CART
    };

    private ActivityHomeBinding binding;
    private SessionManager sessionManager;
    private String activeTag = TAG_HOME;
    private boolean suppressNavCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityHomeBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        sessionManager = new SessionManager(this);

        if (!sessionManager.isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        if (!RoleRouter.ROLE_CUSTOMER.equals(sessionManager.getUser().role)) {
            startActivity(RoleRouter.getHomeIntent(this, sessionManager.getUser().role));
            finish();
            return;
        }

        if (getSupportActionBar() != null) {
            getSupportActionBar().setTitle(R.string.customer_nav_home);
            getSupportActionBar().setSubtitle(sessionManager.getUser().fullName);
        }

        setupBottomNavigation();

        if (savedInstanceState != null) {
            activeTag = savedInstanceState.getString("active_tag", TAG_HOME);
            syncBottomNavWithActiveTag();
            return;
        }

        String initialTab = getIntent().getStringExtra(EXTRA_INITIAL_TAB);
        selectTab(mapTabToNavId(initialTab), false);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String tab = intent.getStringExtra(EXTRA_INITIAL_TAB);
        if (tab != null) {
            selectTab(mapTabToNavId(tab), false);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshCartBadge();
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putString("active_tag", activeTag);
    }

    private void setupBottomNavigation() {
        binding.bottomNavCustomer.setOnItemSelectedListener(item -> {
            if (suppressNavCallback) {
                return true;
            }
            int itemId = item.getItemId();
            if (itemId == R.id.nav_customer_home) {
                showPage(TAG_HOME, CustomerHomeFragment::new, R.string.customer_nav_home);
                return true;
            }
            if (itemId == R.id.nav_customer_orders) {
                showPage(TAG_ORDERS, CustomerOrdersFragment::new, R.string.customer_nav_orders);
                return true;
            }
            if (itemId == R.id.nav_customer_partner) {
                showPage(TAG_PARTNER, CustomerPartnerFragment::new, R.string.customer_nav_partner);
                return true;
            }
            if (itemId == R.id.nav_customer_cart) {
                showPage(TAG_CART, CustomerCartFragment::new, R.string.customer_nav_cart);
                return true;
            }
            if (itemId == R.id.nav_customer_profile) {
                showPage(TAG_PROFILE, CustomerProfileFragment::new, R.string.customer_nav_profile);
                return true;
            }
            return false;
        });
    }

    private int mapTabToNavId(@Nullable String tab) {
        if (TAB_ORDERS.equals(tab)) {
            return R.id.nav_customer_orders;
        }
        if (TAB_CART.equals(tab)) {
            return R.id.nav_customer_cart;
        }
        if (TAB_PARTNER.equals(tab)) {
            return R.id.nav_customer_partner;
        }
        if (TAB_PROFILE.equals(tab)) {
            return R.id.nav_customer_profile;
        }
        return R.id.nav_customer_home;
    }

    private void selectTab(int navItemId, boolean fromUser) {
        if (!fromUser) {
            suppressNavCallback = true;
            binding.bottomNavCustomer.setSelectedItemId(navItemId);
            suppressNavCallback = false;
        }

        if (navItemId == R.id.nav_customer_orders) {
            showPage(TAG_ORDERS, CustomerOrdersFragment::new, R.string.customer_nav_orders);
        } else if (navItemId == R.id.nav_customer_cart) {
            showPage(TAG_CART, CustomerCartFragment::new, R.string.customer_nav_cart);
        } else if (navItemId == R.id.nav_customer_partner) {
            showPage(TAG_PARTNER, CustomerPartnerFragment::new, R.string.customer_nav_partner);
        } else if (navItemId == R.id.nav_customer_profile) {
            showPage(TAG_PROFILE, CustomerProfileFragment::new, R.string.customer_nav_profile);
        } else {
            showPage(TAG_HOME, CustomerHomeFragment::new, R.string.customer_nav_home);
        }
    }

    private void syncBottomNavWithActiveTag() {
        int navId = R.id.nav_customer_home;
        if (TAG_ORDERS.equals(activeTag)) {
            navId = R.id.nav_customer_orders;
        } else if (TAG_CART.equals(activeTag)) {
            navId = R.id.nav_customer_cart;
        } else if (TAG_PARTNER.equals(activeTag)) {
            navId = R.id.nav_customer_partner;
        } else if (TAG_PROFILE.equals(activeTag)) {
            navId = R.id.nav_customer_profile;
        }
        suppressNavCallback = true;
        binding.bottomNavCustomer.setSelectedItemId(navId);
        suppressNavCallback = false;
    }

    private void showPage(String tag, FragmentFactory factory, int titleRes) {
        if (tag.equals(activeTag)) {
            Fragment current = getSupportFragmentManager().findFragmentByTag(tag);
            if (current != null && current.isVisible()) {
                refreshPageIfNeeded(tag, current);
                if (getSupportActionBar() != null) {
                    getSupportActionBar().setTitle(titleRes);
                }
                return;
            }
        }

        activeTag = tag;
        FragmentManager fragmentManager = getSupportFragmentManager();
        FragmentTransaction transaction = fragmentManager.beginTransaction().setReorderingAllowed(true);

        for (String pageTag : ALL_PAGE_TAGS) {
            Fragment page = fragmentManager.findFragmentByTag(pageTag);
            if (page == null) {
                continue;
            }
            if (pageTag.equals(tag)) {
                transaction.show(page);
            } else {
                transaction.hide(page);
            }
        }

        Fragment target = fragmentManager.findFragmentByTag(tag);
        if (target == null) {
            target = factory.create();
            transaction.add(R.id.containerCustomerPages, target, tag);
        } else {
            refreshPageIfNeeded(tag, target);
        }

        transaction.commit();

        if (getSupportActionBar() != null) {
            getSupportActionBar().setTitle(titleRes);
        }
    }

    private void refreshPageIfNeeded(String tag, Fragment target) {
        if (TAG_ORDERS.equals(tag) && target instanceof CustomerOrdersFragment) {
            ((CustomerOrdersFragment) target).reloadOrders();
        } else if (TAG_CART.equals(tag) && target instanceof CustomerCartFragment) {
            ((CustomerCartFragment) target).refreshCartUi();
        }
    }

    @Override
    public void showHomeTab() {
        selectTab(R.id.nav_customer_home, false);
    }

    @Override
    public void showOrdersTab() {
        selectTab(R.id.nav_customer_orders, false);
    }

    @Override
    public void showCartTab() {
        selectTab(R.id.nav_customer_cart, false);
    }

    @Override
    public void showPartnerPage() {
        selectTab(R.id.nav_customer_partner, false);
    }

    @Override
    public void refreshCartBadge() {
        int totalItems = CartManager.getInstance().getTotalItems();
        BottomNavigationView bottomNav = binding.bottomNavCustomer;
        BadgeDrawable badge = bottomNav.getOrCreateBadge(R.id.nav_customer_cart);
        if (totalItems > 0) {
            badge.setVisible(true);
            badge.setNumber(totalItems);
        } else {
            badge.setVisible(false);
            badge.clearNumber();
        }
    }

    @Override
    public void logoutCustomer() {
        sessionManager.clear();
        CartManager.getInstance().clear();
        Intent intent = new Intent(this, LoginActivity.class);
        intent.putExtra(LoginActivity.EXTRA_LOGIN_ROLE, RoleRouter.ROLE_CUSTOMER);
        startActivity(intent);
        finish();
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.menu_driver_home, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        if (item.getItemId() == R.id.action_logout) {
            logoutCustomer();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private interface FragmentFactory {
        Fragment create();
    }
}
