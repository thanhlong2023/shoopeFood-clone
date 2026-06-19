package com.shoopefood.mobile.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.ProgressBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.tabs.TabLayout;
import com.google.android.material.textfield.TextInputEditText;
import com.shoopefood.mobile.R;
import com.shoopefood.mobile.adapter.MerchantOrderAdapter;
import com.shoopefood.mobile.cart.CartManager;
import com.shoopefood.mobile.model.Order;
import com.shoopefood.mobile.model.OrdersResponse;
import com.shoopefood.mobile.model.RejectOrderRequest;
import com.shoopefood.mobile.model.Restaurant;
import com.shoopefood.mobile.model.RestaurantsResponse;
import com.shoopefood.mobile.model.UpdateOrderStatusRequest;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;
import com.shoopefood.mobile.session.SessionManager;
import com.shoopefood.mobile.util.MerchantOrderBuckets;
import com.shoopefood.mobile.util.RoleRouter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class MerchantHomeActivity extends AppCompatActivity implements MerchantOrderAdapter.Listener {

    private SessionManager sessionManager;
    private ApiService apiService;
    private MerchantOrderAdapter adapter;

    private TextView welcomeText;
    private Spinner restaurantSpinner;
    private TabLayout tabLayout;
    private SwipeRefreshLayout swipeRefreshLayout;
    private RecyclerView recyclerView;
    private TextView emptyText;
    private ProgressBar progressBar;

    private TextView textTodayOrders;
    private TextView textTodayRevenue;
    private com.google.android.material.bottomnavigation.BottomNavigationView bottomNavMerchant;

    private final List<Restaurant> restaurants = new ArrayList<>();
    private final List<Order> allOrders = new ArrayList<>();
    private Integer selectedRestaurantId = null;
    private int activeTab = MerchantOrderBuckets.TAB_WAITING;
    private boolean actionInProgress = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_merchant_home);

        sessionManager = new SessionManager(this);
        apiService = ApiClient.getService(this);

        if (!sessionManager.isLoggedIn()) {
            redirectToLogin();
            return;
        }

        if (!RoleRouter.ROLE_MERCHANT.equals(sessionManager.getUser().role)) {
            startActivity(RoleRouter.getHomeIntent(this, sessionManager.getUser().role));
            finish();
            return;
        }

        if (getSupportActionBar() != null) {
            getSupportActionBar().setTitle(R.string.merchant_home_title);
        }

        bindViews();
        welcomeText.setText(getString(R.string.merchant_welcome, sessionManager.getUser().fullName));

        adapter = new MerchantOrderAdapter(this);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        recyclerView.setAdapter(adapter);

        setupTabs();
        swipeRefreshLayout.setOnRefreshListener(this::loadOrders);
        loadRestaurants();
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.menu_merchant_home, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        int itemId = item.getItemId();
        if (itemId == R.id.action_profile) {
            startActivity(new Intent(this, MerchantRestaurantProfileActivity.class));
            return true;
        }
        if (itemId == R.id.action_logout) {
            logout();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (sessionManager.isLoggedIn() && RoleRouter.ROLE_MERCHANT.equals(sessionManager.getUser().role)) {
            loadOrders();
        }
    }

    @Override
    public void onConfirm(Order order) {
        updateOrderStatus(order, "CONFIRMED", R.string.merchant_confirm_success);
    }

    @Override
    public void onReject(Order order) {
        View dialogView = getLayoutInflater().inflate(R.layout.dialog_reject_order, null);
        TextInputEditText reasonInput = dialogView.findViewById(R.id.inputRejectReason);

        new AlertDialog.Builder(this)
                .setTitle(R.string.merchant_reject_order)
                .setView(dialogView)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.merchant_reject_submit, (dialog, which) -> {
                    String reason = reasonInput.getText() != null ? reasonInput.getText().toString().trim() : "";
                    if (reason.isEmpty()) {
                        Toast.makeText(this, R.string.merchant_reject_reason_required, Toast.LENGTH_SHORT).show();
                        return;
                    }
                    rejectOrder(order, reason);
                })
                .show();
    }

    @Override
    public void onMarkReady(Order order) {
        String nextStatus = MerchantOrderBuckets.getNextStatusForCookingAction(order.statusCode);
        if (nextStatus == null) {
            return;
        }
        updateOrderStatus(order, nextStatus, R.string.merchant_ready_success);
    }

    private void bindViews() {
        welcomeText = findViewById(R.id.textMerchantWelcome);
        restaurantSpinner = findViewById(R.id.spinnerRestaurantFilter);
        tabLayout = findViewById(R.id.tabOrderBuckets);
        swipeRefreshLayout = findViewById(R.id.swipeRefreshMerchantOrders);
        recyclerView = findViewById(R.id.recyclerMerchantOrders);
        emptyText = findViewById(R.id.textEmptyMerchantOrders);
        progressBar = findViewById(R.id.progressMerchantOrders);
        textTodayOrders = findViewById(R.id.textTodayOrders);
        textTodayRevenue = findViewById(R.id.textTodayRevenue);
        bottomNavMerchant = findViewById(R.id.bottomNavMerchant);

        bottomNavMerchant.setOnItemSelectedListener(item -> {
            int itemId = item.getItemId();
            if (itemId == R.id.nav_inventory) {
                Intent intent = new Intent(this, MerchantQuickInventoryActivity.class);
                if (selectedRestaurantId != null) {
                    intent.putExtra(MerchantQuickInventoryActivity.EXTRA_RESTAURANT_ID, selectedRestaurantId);
                }
                startActivity(intent);
                return false; // Don't check the item, keep 'Orders' active here
            } else if (itemId == R.id.nav_profile) {
                startActivity(new Intent(this, MerchantRestaurantProfileActivity.class));
                return false;
            }
            return true;
        });
    }

    private void setupTabs() {
        tabLayout.addTab(tabLayout.newTab().setText(getTabTitle(MerchantOrderBuckets.TAB_WAITING, 0)));
        tabLayout.addTab(tabLayout.newTab().setText(getTabTitle(MerchantOrderBuckets.TAB_COOKING, 0)));
        tabLayout.addTab(tabLayout.newTab().setText(getTabTitle(MerchantOrderBuckets.TAB_DONE, 0)));

        tabLayout.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override
            public void onTabSelected(TabLayout.Tab tab) {
                activeTab = tab.getPosition();
                renderOrders();
            }

            @Override
            public void onTabUnselected(TabLayout.Tab tab) {
            }

            @Override
            public void onTabReselected(TabLayout.Tab tab) {
            }
        });
    }

    private void loadRestaurants() {
        apiService.getMyRestaurants().enqueue(new Callback<RestaurantsResponse>() {
            @Override
            public void onResponse(Call<RestaurantsResponse> call, Response<RestaurantsResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    Toast.makeText(MerchantHomeActivity.this, ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                    return;
                }

                restaurants.clear();
                restaurants.addAll(response.body().data);
                setupRestaurantSpinner();
                loadOrders();
            }

            @Override
            public void onFailure(Call<RestaurantsResponse> call, Throwable t) {
                Toast.makeText(MerchantHomeActivity.this, R.string.network_error, Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void setupRestaurantSpinner() {
        List<String> labels = new ArrayList<>();
        labels.add(getString(R.string.merchant_all_branches));
        for (Restaurant restaurant : restaurants) {
            labels.add("#" + restaurant.id + " - " + restaurant.name);
        }

        ArrayAdapter<String> spinnerAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, labels);
        restaurantSpinner.setAdapter(spinnerAdapter);
        restaurantSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (position == 0) {
                    selectedRestaurantId = null;
                } else {
                    selectedRestaurantId = restaurants.get(position - 1).id;
                }
                loadOrders();
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {
            }
        });
    }

    private void loadOrders() {
        if (actionInProgress) {
            return;
        }

        if (!swipeRefreshLayout.isRefreshing()) {
            progressBar.setVisibility(View.VISIBLE);
        }

        apiService.getMerchantOrders(selectedRestaurantId).enqueue(new Callback<OrdersResponse>() {
            @Override
            public void onResponse(Call<OrdersResponse> call, Response<OrdersResponse> response) {
                progressBar.setVisibility(View.GONE);
                swipeRefreshLayout.setRefreshing(false);

                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    Toast.makeText(MerchantHomeActivity.this, ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                    return;
                }

                allOrders.clear();
                allOrders.addAll(response.body().data);
                updateTabBadges();
                computeDashboardStats();
                renderOrders();
            }

            @Override
            public void onFailure(Call<OrdersResponse> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                swipeRefreshLayout.setRefreshing(false);
                Toast.makeText(MerchantHomeActivity.this, R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void computeDashboardStats() {
        int todayOrdersCount = 0;
        double todayRevenue = 0.0;
        java.text.SimpleDateFormat format = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault());
        String todayStr = format.format(new java.util.Date());

        for (Order order : allOrders) {
            if (order.createdAt != null && order.createdAt.startsWith(todayStr)) {
                todayOrdersCount++;
                if (!"CANCELLED".equals(order.statusCode) && !"TIMEOUT".equals(order.statusCode)) {
                    todayRevenue += order.totalAmount;
                }
            }
        }
        textTodayOrders.setText(String.valueOf(todayOrdersCount));
        textTodayRevenue.setText(String.format(java.util.Locale.getDefault(), "%,.0f đ", todayRevenue));
    }

    private void renderOrders() {
        Map<Integer, String> restaurantNames = new HashMap<>();
        for (Restaurant restaurant : restaurants) {
            restaurantNames.put(restaurant.id, restaurant.name);
        }
        adapter.setRestaurantNames(restaurantNames);
        adapter.submitOrders(allOrders, activeTab);

        List<Order> visible = MerchantOrderBuckets.filter(allOrders, activeTab);
        emptyText.setVisibility(visible.isEmpty() ? View.VISIBLE : View.GONE);
        emptyText.setText(getEmptyMessage(activeTab));
    }

    private void updateTabBadges() {
        if (tabLayout.getTabCount() < 3) {
            return;
        }
        tabLayout.getTabAt(0).setText(getTabTitle(MerchantOrderBuckets.TAB_WAITING, MerchantOrderBuckets.count(allOrders, MerchantOrderBuckets.TAB_WAITING)));
        tabLayout.getTabAt(1).setText(getTabTitle(MerchantOrderBuckets.TAB_COOKING, MerchantOrderBuckets.count(allOrders, MerchantOrderBuckets.TAB_COOKING)));
        tabLayout.getTabAt(2).setText(getTabTitle(MerchantOrderBuckets.TAB_DONE, MerchantOrderBuckets.count(allOrders, MerchantOrderBuckets.TAB_DONE)));
    }

    private String getTabTitle(int tab, int count) {
        String label;
        switch (tab) {
            case MerchantOrderBuckets.TAB_COOKING:
                label = getString(R.string.merchant_tab_cooking);
                break;
            case MerchantOrderBuckets.TAB_DONE:
                label = getString(R.string.merchant_tab_done);
                break;
            default:
                label = getString(R.string.merchant_tab_waiting);
                break;
        }
        return count > 0 ? label + " (" + count + ")" : label;
    }

    private int getEmptyMessage(int tab) {
        switch (tab) {
            case MerchantOrderBuckets.TAB_COOKING:
                return R.string.merchant_empty_cooking;
            case MerchantOrderBuckets.TAB_DONE:
                return R.string.merchant_empty_done;
            default:
                return R.string.merchant_empty_waiting;
        }
    }

    private void updateOrderStatus(Order order, String statusCode, int successMessageRes) {
        if (actionInProgress) {
            return;
        }
        actionInProgress = true;
        progressBar.setVisibility(View.VISIBLE);

        apiService.updateOrderStatus(order.id, new UpdateOrderStatusRequest(statusCode, order.version))
                .enqueue(new Callback<com.shoopefood.mobile.model.OrderResponse>() {
                    @Override
                    public void onResponse(Call<com.shoopefood.mobile.model.OrderResponse> call, Response<com.shoopefood.mobile.model.OrderResponse> response) {
                        actionInProgress = false;
                        progressBar.setVisibility(View.GONE);
                        if (!response.isSuccessful()) {
                            Toast.makeText(MerchantHomeActivity.this, ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                            return;
                        }
                        Toast.makeText(MerchantHomeActivity.this, successMessageRes, Toast.LENGTH_SHORT).show();
                        loadOrders();
                    }

                    @Override
                    public void onFailure(Call<com.shoopefood.mobile.model.OrderResponse> call, Throwable t) {
                        actionInProgress = false;
                        progressBar.setVisibility(View.GONE);
                        Toast.makeText(MerchantHomeActivity.this, R.string.network_error, Toast.LENGTH_LONG).show();
                    }
                });
    }

    private void rejectOrder(Order order, String reason) {
        if (actionInProgress) {
            return;
        }
        actionInProgress = true;
        progressBar.setVisibility(View.VISIBLE);

        apiService.rejectOrder(order.id, new RejectOrderRequest(reason, order.version))
                .enqueue(new Callback<com.shoopefood.mobile.model.OrderResponse>() {
                    @Override
                    public void onResponse(Call<com.shoopefood.mobile.model.OrderResponse> call, Response<com.shoopefood.mobile.model.OrderResponse> response) {
                        actionInProgress = false;
                        progressBar.setVisibility(View.GONE);
                        if (!response.isSuccessful()) {
                            Toast.makeText(MerchantHomeActivity.this, ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                            return;
                        }
                        Toast.makeText(MerchantHomeActivity.this, R.string.merchant_reject_success, Toast.LENGTH_SHORT).show();
                        loadOrders();
                    }

                    @Override
                    public void onFailure(Call<com.shoopefood.mobile.model.OrderResponse> call, Throwable t) {
                        actionInProgress = false;
                        progressBar.setVisibility(View.GONE);
                        Toast.makeText(MerchantHomeActivity.this, R.string.network_error, Toast.LENGTH_LONG).show();
                    }
                });
    }

    private void logout() {
        sessionManager.clear();
        CartManager.getInstance().clear();
        redirectToLogin();
    }

    private void redirectToLogin() {
        Intent login = new Intent(this, LoginActivity.class);
        login.putExtra(LoginActivity.EXTRA_LOGIN_ROLE, RoleRouter.ROLE_MERCHANT);
        startActivity(login);
        finish();
    }
}
