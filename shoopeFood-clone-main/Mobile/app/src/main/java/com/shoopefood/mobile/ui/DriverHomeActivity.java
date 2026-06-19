package com.shoopefood.mobile.ui;

import android.Manifest;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentTransaction;
import androidx.lifecycle.ViewModelProvider;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.google.android.material.tabs.TabLayout;
import com.shoopefood.mobile.R;
import com.shoopefood.mobile.cart.CartManager;
import com.shoopefood.mobile.databinding.ActivityDriverHomeBinding;
import com.shoopefood.mobile.location.DriverLocationHelper;
import com.shoopefood.mobile.location.LocationTrackingService;
import com.shoopefood.mobile.location.PermissionHelper;
import com.shoopefood.mobile.map.DriverMapController;
import com.shoopefood.mobile.util.DriverWorkPhaseUtils;
import com.shoopefood.mobile.model.Driver;
import com.shoopefood.mobile.model.Order;
import com.shoopefood.mobile.session.SessionManager;
import com.shoopefood.mobile.model.RoutePoint;
import com.shoopefood.mobile.util.DriverNearbyOrderUtils;
import com.shoopefood.mobile.util.GeoUtils;
import com.shoopefood.mobile.util.RoleRouter;
import com.shoopefood.mobile.viewmodel.DriverHomeViewModel;
import com.shoopefood.mobile.viewmodel.DriverHomeViewModelFactory;
import com.shoopefood.mobile.viewmodel.DriverLocationState;
import com.shoopefood.mobile.viewmodel.DriverUiState;

import java.util.ArrayList;
import java.util.List;

public class DriverHomeActivity extends AppCompatActivity implements DriverHomeHost {

    private static final String TAG_NEARBY = "driver_orders_nearby";
    private static final String TAG_ACTIVE = "driver_orders_active";
    private static final String TAG_COMPLETED = "driver_orders_completed";
    private static final String TAG_PAGE_PROFILE = "driver_page_profile";
    private static final String TAG_PAGE_MENU = "driver_page_menu";
    private static final String TAG_PAGE_INCOME = "driver_page_income";

    private ActivityDriverHomeBinding binding;
    private DriverHomeViewModel viewModel;
    private DriverLocationHelper locationHelper;
    private DriverMapController mapController;
    private SessionManager sessionManager;

    // ─── Foreground Service Binding ──────────────────────────────────────────

    /** Reference đến service khi đã bind — null khi chưa bind */
    private LocationTrackingService trackingService;
    private boolean isServiceBound = false;

    /**
     * ServiceConnection: callback khi bind/unbind service thành công.
     * Pattern: Activity nắm IBinder, đút ra LocationTrackingService instance.
     */
    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            LocationTrackingService.LocationServiceBinder serviceBinder =
                    (LocationTrackingService.LocationServiceBinder) binder;
            trackingService = serviceBinder.getService();
            isServiceBound = true;
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            trackingService = null;
            isServiceBound = false;
            if (viewModel != null) {
                viewModel.onTrackingStopped();
            }
        }
    };

    /** Bind to the foreground location tracking service and start it */
    private void bindLocationService() {
        Intent intent = new Intent(this, LocationTrackingService.class);
        // Start the service in foreground mode
        intent.setAction(LocationTrackingService.ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
        // Bind to receive direct calls if needed
        bindService(new Intent(this, LocationTrackingService.class), serviceConnection, BIND_AUTO_CREATE);
    }

    /** Unbind and stop the location tracking service */
    private void unbindLocationService() {
        if (isServiceBound) {
            unbindService(serviceConnection);
            isServiceBound = false;
        }
        // Stop the foreground service
        Intent stopIntent = new Intent(this, LocationTrackingService.class);
        stopIntent.setAction(LocationTrackingService.ACTION_STOP);
        stopService(stopIntent);
    }


    /**
     * BroadcastReceiver: nhận location updates từ LocationTrackingService.
     * Đây là communication bridge: Service → Activity → ViewModel.
     *
     * <p>Tương đương Kotlin: collectLatest { } trong LaunchedEffect.
     */
    private final BroadcastReceiver locationReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (viewModel == null) return;

            String action = intent.getAction();
            if (LocationTrackingService.BROADCAST_LOCATION_UPDATE.equals(action)) {
                double lat    = intent.getDoubleExtra(LocationTrackingService.EXTRA_LATITUDE, 0);
                double lng    = intent.getDoubleExtra(LocationTrackingService.EXTRA_LONGITUDE, 0);
                float bearing = intent.getFloatExtra(LocationTrackingService.EXTRA_BEARING, 0);
                float acc     = intent.getFloatExtra(LocationTrackingService.EXTRA_ACCURACY, 0);
                float speed   = intent.getFloatExtra(LocationTrackingService.EXTRA_SPEED_KMH, 0);
                viewModel.onLocationUpdate(lat, lng, bearing, acc, speed);

            } else if (LocationTrackingService.BROADCAST_LOCATION_ERROR.equals(action)) {
                String errorType = intent.getStringExtra(LocationTrackingService.EXTRA_ERROR_TYPE);
                String errorMsg  = intent.getStringExtra(LocationTrackingService.EXTRA_ERROR_MSG);
                viewModel.onLocationError(errorType, errorMsg);
                handleLocationError(errorType, errorMsg);
            }
        }
    };

    private boolean pendingGoOnline = false;
    private boolean locationWatchActive = false;
    private boolean pullRefreshActive = false;

    private void handleLocationError(String errorType, String errorMsg) {
        if ("PERMISSION_DENIED".equals(errorType)) {
            android.widget.Toast.makeText(this, "Vui lòng cấp quyền vị trí để tiếp tục", android.widget.Toast.LENGTH_LONG).show();
            PermissionHelper.requestLocationPermissions(this, multiPermissionLauncher, () -> {
                // Permission granted
            });
        } else if ("GPS_DISABLED".equals(errorType)) {
            PermissionHelper.showGpsDisabledDialog(this, () -> {
                Intent intent = new Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                startActivity(intent);
            });
        } else {
            android.widget.Toast.makeText(this, "Lỗi vị trí: " + errorMsg, android.widget.Toast.LENGTH_SHORT).show();
        }
    }

    // ─── Permission Launchers ────────────────────────────────────────────────

    /**
     * Multi-permission launcher — xử lý cả ACCESS_FINE_LOCATION + POST_NOTIFICATIONS.
     *
     * <p>Kotlin tương đương:
     * <pre>
     *   val permState = rememberMultiplePermissionsState(permissions) { results -&gt;
     *       if (results.all { it.value }) startService()
     *       else showRationale()
     *   }
     * </pre>
     */
    private final ActivityResultLauncher<String[]> multiPermissionLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.RequestMultiplePermissions(),
                    results -> {
                        boolean locationGranted = Boolean.TRUE.equals(
                                results.get(Manifest.permission.ACCESS_FINE_LOCATION)
                        );
                        if (locationGranted) {
                            if (pendingGoOnline) {
                                fetchLocationAndGoOnline();
                            } else {
                                bindLocationService();
                            }
                        } else {
                            pendingGoOnline = false;
                            // Kiểm tra có phải "Don't ask again" không
                            boolean canAskAgain = shouldShowRequestPermissionRationale(
                                    Manifest.permission.ACCESS_FINE_LOCATION
                            );
                            if (!canAskAgain) {
                                PermissionHelper.showGoToSettingsDialog(this);
                            } else {
                                Toast.makeText(this,
                                        R.string.driver_location_permission_denied,
                                        Toast.LENGTH_LONG).show();
                            }
                            renderToggleButton(false, false);
                        }
                    }
            );

    /** Legacy single-permission launcher — giữ lại để backward compat */
    private final ActivityResultLauncher<String> locationPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
                if (granted) {
                    if (pendingGoOnline) {
                        fetchLocationAndGoOnline();
                    } else {
                        startLocationWatchIfNeeded();
                    }
                } else {
                    pendingGoOnline = false;
                    Toast.makeText(this, R.string.driver_location_permission_denied, Toast.LENGTH_LONG).show();
                    renderToggleButton(false, false);
                }
            });

    private final ActivityResultLauncher<IntentSenderRequest> locationSettingsLauncher =
            registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), result -> {
                if (result.getResultCode() == Activity.RESULT_OK) {
                    if (pendingGoOnline) {
                        fetchLocationAndGoOnline();
                    } else {
                        startLocationWatchIfNeeded();
                    }
                } else if (pendingGoOnline) {
                    pendingGoOnline = false;
                    binding.progressDriverOrders.setVisibility(View.GONE);
                    renderToggleButton(false, false);
                    Toast.makeText(this, R.string.driver_location_disabled, Toast.LENGTH_LONG).show();
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityDriverHomeBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        sessionManager = new SessionManager(this);
        locationHelper = new DriverLocationHelper(this);

        if (!sessionManager.isLoggedIn()) {
            redirectToLogin();
            return;
        }

        if (!RoleRouter.ROLE_DRIVER.equals(sessionManager.getUser().role)) {
            startActivity(RoleRouter.getHomeIntent(this, sessionManager.getUser().role));
            finish();
            return;
        }

        if (getSupportActionBar() != null) {
            getSupportActionBar().setTitle(R.string.driver_home_title);
        }

        setupOrderFragments();
        setupTabs();
        setupMap();
        setupViewModel();
        // Bind to location tracking service and register broadcast receiver
        if (PermissionHelper.hasLocationPermission(this)) {
            bindLocationService();
        }
        LocalBroadcastManager.getInstance(this).registerReceiver(locationReceiver, new IntentFilter(LocationTrackingService.BROADCAST_LOCATION_UPDATE));
        LocalBroadcastManager.getInstance(this).registerReceiver(locationReceiver, new IntentFilter(LocationTrackingService.BROADCAST_LOCATION_ERROR));
        setupToggleButton();
        setupReloadButton();
        setupSwipeRefresh();
        setupDeliveryButton();
        setupBottomNavigation();
    }

    private void setupBottomNavigation() {
        binding.bottomNavDriver.setSelectedItemId(R.id.nav_driver_delivery);
        binding.bottomNavDriver.setOnItemSelectedListener(item -> {
            int itemId = item.getItemId();
            if (itemId == R.id.nav_driver_delivery) {
                showDeliveryPage();
                return true;
            }
            if (itemId == R.id.nav_driver_profile) {
                showSecondaryPage(TAG_PAGE_PROFILE, new DriverProfileFragment());
                setToolbarTitle(R.string.driver_profile_title);
                return true;
            }
            if (itemId == R.id.nav_driver_menu) {
                showSecondaryPage(TAG_PAGE_MENU, new DriverMenuFragment());
                setToolbarTitle(R.string.driver_nav_menu);
                return true;
            }
            if (itemId == R.id.nav_driver_income) {
                showSecondaryPage(TAG_PAGE_INCOME, new DriverIncomeFragment());
                setToolbarTitle(R.string.driver_nav_income);
                return true;
            }
            return false;
        });
    }

    @Override
    public void showDeliveryTab() {
        if (binding.bottomNavDriver.getSelectedItemId() == R.id.nav_driver_delivery) {
            showDeliveryPage();
        } else {
            binding.bottomNavDriver.setSelectedItemId(R.id.nav_driver_delivery);
        }
    }

    @Override
    public void reloadDeliveryFeed() {
        showDeliveryTab();
        pullRefreshActive = true;
        if (viewModel != null) {
            viewModel.loadFeed();
        }
    }

    @Override
    public void logoutDriver() {
        if (viewModel != null && viewModel.getUiState().getValue() != null
                && viewModel.getUiState().getValue().driver != null
                && viewModel.getUiState().getValue().driver.isOnline) {
            viewModel.goOffline();
        }
        sessionManager.clear();
        CartManager.getInstance().clear();
        redirectToLogin();
    }

    private void showDeliveryPage() {
        binding.deliveryContentRoot.setVisibility(View.VISIBLE);
        binding.containerDriverPages.setVisibility(View.GONE);
        setToolbarTitle(R.string.driver_home_title);
    }

    private void showSecondaryPage(String tag, Fragment fragment) {
        binding.deliveryContentRoot.setVisibility(View.GONE);
        binding.containerDriverPages.setVisibility(View.VISIBLE);

        Fragment existing = getSupportFragmentManager().findFragmentByTag(tag);
        FragmentTransaction transaction = getSupportFragmentManager().beginTransaction()
                .setReorderingAllowed(true);

        Fragment profile = getSupportFragmentManager().findFragmentByTag(TAG_PAGE_PROFILE);
        Fragment menu = getSupportFragmentManager().findFragmentByTag(TAG_PAGE_MENU);
        Fragment income = getSupportFragmentManager().findFragmentByTag(TAG_PAGE_INCOME);
        if (profile != null) {
            transaction.hide(profile);
        }
        if (menu != null) {
            transaction.hide(menu);
        }
        if (income != null) {
            transaction.hide(income);
        }

        if (existing == null) {
            transaction.add(R.id.containerDriverPages, fragment, tag);
        } else {
            transaction.show(existing);
        }
        transaction.commit();
    }

    private void setToolbarTitle(int titleRes) {
        if (getSupportActionBar() != null) {
            getSupportActionBar().setTitle(titleRes);
        }
    }

    private void setupSwipeRefresh() {
        binding.swipeRefreshDriver.setColorSchemeResources(R.color.brand_green);
        binding.swipeRefreshDriver.setOnRefreshListener(() -> {
            pullRefreshActive = true;
            viewModel.loadFeed();
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mapController != null) {
            mapController.onResume();
        }
        startLocationWatchIfNeeded();
        if (viewModel != null) {
            viewModel.refreshFeedIfOnline();
        }
    }

    @Override
    protected void onPause() {
        // Unregister receivers and unbind service when activity is no longer visible
        LocalBroadcastManager.getInstance(this).unregisterReceiver(locationReceiver);
        unbindLocationService();
        if (viewModel != null) {
            viewModel.stopFeedPolling();
        }
        stopLocationWatch();
        if (mapController != null) {
            mapController.onPause();
        }
        super.onPause();
    }

    private void setupOrderFragments() {
        if (getSupportFragmentManager().findFragmentByTag(TAG_NEARBY) != null) {
            if (getSupportFragmentManager().findFragmentByTag(TAG_COMPLETED) == null) {
                Fragment completed = DriverOrdersListFragment.newInstance(DriverOrdersListFragment.MODE_COMPLETED);
                getSupportFragmentManager().beginTransaction()
                        .add(binding.containerDriverOrders.getId(), completed, TAG_COMPLETED)
                        .hide(completed)
                        .commit();
            }
            return;
        }

        Fragment nearby = DriverOrdersListFragment.newInstance(DriverOrdersListFragment.MODE_NEARBY);
        Fragment active = DriverOrdersListFragment.newInstance(DriverOrdersListFragment.MODE_ACTIVE);
        Fragment completed = DriverOrdersListFragment.newInstance(DriverOrdersListFragment.MODE_COMPLETED);

        getSupportFragmentManager().beginTransaction()
                .add(binding.containerDriverOrders.getId(), nearby, TAG_NEARBY)
                .add(binding.containerDriverOrders.getId(), active, TAG_ACTIVE)
                .add(binding.containerDriverOrders.getId(), completed, TAG_COMPLETED)
                .hide(active)
                .hide(completed)
                .commit();
    }

    private void setupMap() {
        mapController = new DriverMapController(binding.mapDriver);
    }

    private void setupTabs() {
        binding.tabDriverOrders.addTab(binding.tabDriverOrders.newTab().setText(R.string.driver_tab_available));
        binding.tabDriverOrders.addTab(binding.tabDriverOrders.newTab().setText(R.string.driver_tab_active));
        binding.tabDriverOrders.addTab(binding.tabDriverOrders.newTab().setText(R.string.driver_tab_completed));

        binding.tabDriverOrders.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override
            public void onTabSelected(TabLayout.Tab tab) {
                viewModel.selectTab(tab.getPosition());
            }

            @Override
            public void onTabUnselected(TabLayout.Tab tab) {
            }

            @Override
            public void onTabReselected(TabLayout.Tab tab) {
            }
        });
    }

    private void setupViewModel() {
        viewModel = new ViewModelProvider(
                this,
                new DriverHomeViewModelFactory(getApplication())
        ).get(DriverHomeViewModel.class);

        viewModel.getUiState().observe(this, this::renderState);
        viewModel.getToastMessage().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                Toast.makeText(this, message, Toast.LENGTH_LONG).show();
            }
        });

        viewModel.loadFeed();
    }

    private void setupReloadButton() {
        binding.buttonReloadOrders.setOnClickListener(v -> {
            DriverUiState state = viewModel.getUiState().getValue();
            if (state == null || state.driver == null || !state.driver.isOnline) {
                Toast.makeText(this, R.string.driver_reload_requires_online, Toast.LENGTH_LONG).show();
                return;
            }
            viewModel.reloadNearbyOrders();
        });
    }

    private void setupToggleButton() {
        binding.buttonToggleReceiving.setOnClickListener(v -> {
            DriverUiState state = viewModel.getUiState().getValue();
            boolean isOnline = state != null && state.driver != null && state.driver.isOnline;

            if (isOnline) {
                viewModel.goOffline();
            } else {
                startGoOnlineFlow();
            }
        });
    }

    private void startGoOnlineFlow() {
        pendingGoOnline = true;
        renderToggleButton(false, true);

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION);
            return;
        }
        fetchLocationAndGoOnline();
    }

    private void fetchLocationAndGoOnline() {
        binding.buttonToggleReceiving.setText(R.string.driver_fetching_location);
        binding.buttonToggleReceiving.setEnabled(false);
        binding.progressDriverOrders.setVisibility(View.VISIBLE);

        locationHelper.ensureLocationEnabled(
                this,
                () -> locationHelper.fetchCurrentLocation(this, new DriverLocationHelper.OnLocationResult() {
                    @Override
                    public void onSuccess(double latitude, double longitude, float accuracyMeters) {
                        binding.progressDriverOrders.setVisibility(View.GONE);
                        pendingGoOnline = false;
                        viewModel.goOnline(latitude, longitude);
                        if (!isServiceBound) {
                            bindLocationService();
                        }
                    }

                    @Override
                    public void onError(String message) {
                        binding.progressDriverOrders.setVisibility(View.GONE);
                        pendingGoOnline = false;
                        renderToggleButton(false, false);
                        Toast.makeText(DriverHomeActivity.this, message, Toast.LENGTH_LONG).show();
                    }
                }),
                exception -> {
                    try {
                        locationSettingsLauncher.launch(
                                new IntentSenderRequest.Builder(exception.getResolution()).build()
                        );
                    } catch (Exception error) {
                        binding.progressDriverOrders.setVisibility(View.GONE);
                        pendingGoOnline = false;
                        renderToggleButton(false, false);
                        Toast.makeText(this, R.string.driver_location_disabled, Toast.LENGTH_LONG).show();
                    }
                },
                () -> {
                    binding.progressDriverOrders.setVisibility(View.GONE);
                    pendingGoOnline = false;
                    renderToggleButton(false, false);
                    Toast.makeText(this, R.string.driver_location_disabled, Toast.LENGTH_LONG).show();
                }
        );
    }

    private void startLocationWatchIfNeeded() {
        DriverUiState state = viewModel != null ? viewModel.getUiState().getValue() : null;
        boolean shouldWatch = state != null && state.driver != null && state.driver.isOnline;
        if (!shouldWatch) {
            stopLocationWatch();
            return;
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        if (locationWatchActive) {
            return;
        }

        locationHelper.ensureLocationEnabled(
                this,
                () -> {
                    locationWatchActive = true;
                    locationHelper.startWatching(new DriverLocationHelper.OnLocationResult() {
                        @Override
                        public void onSuccess(double latitude, double longitude, float accuracyMeters) {
                            runOnUiThread(() -> viewModel.applyGpsLocation(latitude, longitude, accuracyMeters));
                        }

                        @Override
                        public void onError(String message) {
                        }
                    });
                },
                exception -> {
                    try {
                        locationSettingsLauncher.launch(
                                new IntentSenderRequest.Builder(exception.getResolution()).build()
                        );
                    } catch (Exception error) {
                        Toast.makeText(this, R.string.driver_location_disabled, Toast.LENGTH_LONG).show();
                    }
                },
                () -> Toast.makeText(this, R.string.driver_location_disabled, Toast.LENGTH_LONG).show()
        );
    }

    private void stopLocationWatch() {
        locationWatchActive = false;
        locationHelper.stopWatching();
        locationHelper.stopFetch();
    }

    private void renderState(DriverUiState state) {
        if (state == null) {
            return;
        }

        boolean isOnline = state.driver != null && state.driver.isOnline;
        bindDriverProfile(state.driver, isOnline);
        renderToggleButton(isOnline, state.statusUpdating || pendingGoOnline);

        boolean isNearbyTab = state.selectedTab == DriverUiState.TAB_AVAILABLE;
        boolean isCompletedTab = state.selectedTab == DriverUiState.TAB_COMPLETED;
        int nearbyCount = countNearbyOrders(state, isOnline);
        bindListHeader(isOnline, nearbyCount, isNearbyTab, isCompletedTab, state.completedOrders.size());
        bindWorkPhase(state);

        boolean acceptingOrder = state.acceptingOrderId != DriverUiState.NO_ACCEPTING_ORDER;
        boolean isLoading = state.loading || state.statusUpdating || pendingGoOnline || acceptingOrder;
        if (!state.loading && !state.statusUpdating) {
            pullRefreshActive = false;
            binding.swipeRefreshDriver.setRefreshing(false);
        } else if (pullRefreshActive) {
            binding.swipeRefreshDriver.setRefreshing(true);
        }
        binding.progressDriverOrders.setVisibility(
                isLoading && !binding.swipeRefreshDriver.isRefreshing() ? View.VISIBLE : View.GONE
        );

        updateTabTitles(state, isOnline);
        syncTabSelection(state.selectedTab);
        showOrdersTab(state.selectedTab);
        bindMap(state, isOnline);

        if (state.activeDeliveryOrderId > 0) {
            binding.buttonDeliverToCustomer.setVisibility(View.VISIBLE);
            if (com.shoopefood.mobile.util.DriverWorkPhaseUtils.TO_RESTAURANT.equals(state.driverWorkPhase)) {
                if (state.simulationRunning) {
                    binding.buttonDeliverToCustomer.setText("Đang đi lấy món...");
                    binding.buttonDeliverToCustomer.setEnabled(false);
                } else {
                    binding.buttonDeliverToCustomer.setText("Đi lấy món");
                    binding.buttonDeliverToCustomer.setEnabled(true);
                }
            } else if (com.shoopefood.mobile.util.DriverWorkPhaseUtils.AT_RESTAURANT.equals(state.driverWorkPhase)) {
                if (state.simulationRunning) {
                    binding.buttonDeliverToCustomer.setText("Đang đi giao hàng...");
                    binding.buttonDeliverToCustomer.setEnabled(false);
                } else {
                    binding.buttonDeliverToCustomer.setText("Đã lấy đồ ăn & Đi giao");
                    binding.buttonDeliverToCustomer.setEnabled(true);
                }
            } else if (com.shoopefood.mobile.util.DriverWorkPhaseUtils.DELIVERING.equals(state.driverWorkPhase)) {
                binding.buttonDeliverToCustomer.setText("Đang đi giao hàng...");
                binding.buttonDeliverToCustomer.setEnabled(false);
            } else {
                binding.buttonDeliverToCustomer.setVisibility(View.GONE);
            }
        } else {
            binding.buttonDeliverToCustomer.setVisibility(View.GONE);
        }

        if (isOnline && !state.simulationRunning) {
            startLocationWatchIfNeeded();
        } else {
            stopLocationWatch();
        }
    }

    private void setupDeliveryButton() {
        binding.buttonDeliverToCustomer.setOnClickListener(v -> {
            DriverUiState state = viewModel.getUiState().getValue();
            if (state == null) return;
            if (com.shoopefood.mobile.util.DriverWorkPhaseUtils.TO_RESTAURANT.equals(state.driverWorkPhase)) {
                viewModel.startGoToMerchant();
            } else if (com.shoopefood.mobile.util.DriverWorkPhaseUtils.AT_RESTAURANT.equals(state.driverWorkPhase)) {
                viewModel.startDeliverToCustomer();
            }
        });
    }

    private void showOrdersTab(int selectedTab) {
        Fragment nearby = getSupportFragmentManager().findFragmentByTag(TAG_NEARBY);
        Fragment active = getSupportFragmentManager().findFragmentByTag(TAG_ACTIVE);
        Fragment completed = getSupportFragmentManager().findFragmentByTag(TAG_COMPLETED);
        if (nearby == null || active == null || completed == null) {
            return;
        }

        FragmentTransaction transaction = getSupportFragmentManager().beginTransaction();
        transaction.hide(nearby).hide(active).hide(completed);
        if (selectedTab == DriverUiState.TAB_AVAILABLE) {
            transaction.show(nearby);
        } else if (selectedTab == DriverUiState.TAB_COMPLETED) {
            transaction.show(completed);
        } else {
            transaction.show(active);
        }
        transaction.commit();
    }

    private void bindMap(DriverUiState state, boolean isOnline) {
        if (mapController == null) {
            return;
        }

        if (!isOnline || state.driverLatitude == null || state.driverLongitude == null) {
            binding.textDriverMapSummary.setText(R.string.driver_map_offline);
            mapController.update(null, null, null, false);
            return;
        }

        if (state.activeDeliveryOrderId > 0 && !state.routePolyline.isEmpty()) {
            List<RoutePoint> route = state.routePolyline;
            if (!route.isEmpty()) {
                binding.textDriverMapSummary.setText(buildDeliveryMapSummary(state));
                boolean toCustomer = DriverUiState.ROUTE_LEG_TO_CUSTOMER.equals(state.routeLeg);
                mapController.showDeliveryRoute(new DriverMapController.DeliveryMapSnapshot(
                        state.driverLatitude,
                        state.driverLongitude,
                        route,
                        toCustomer,
                        state.activeRestaurantName,
                        state.activeRestaurantLat,
                        state.activeRestaurantLng,
                        state.customerLatitude != null && state.customerLongitude != null,
                        state.customerLatitude,
                        state.customerLongitude,
                        state.routeLeg
                ));
                return;
            }
        }

        String coords = getString(
                R.string.driver_map_coords,
                state.driverLatitude,
                state.driverLongitude
        );
        int restaurantCount = state.nearbyRestaurantPins.size();
        if (restaurantCount > 0) {
            binding.textDriverMapSummary.setText(
                    coords + " · " + getString(R.string.driver_map_online_summary, restaurantCount)
            );
        } else {
            binding.textDriverMapSummary.setText(
                    coords + " · " + getString(R.string.driver_map_online_empty)
            );
        }

        mapController.update(
                state.driverLatitude,
                state.driverLongitude,
                state.nearbyRestaurantPins,
                true
        );
    }

    private String buildDeliveryMapSummary(DriverUiState state) {
        String coords = getString(R.string.driver_map_coords, state.driverLatitude, state.driverLongitude);
        if (state.simulationRunning) {
            if (DriverUiState.ROUTE_LEG_TO_CUSTOMER.equals(state.routeLeg)) {
                return coords + " · " + getString(R.string.driver_simulating_to_customer);
            }
            return coords + " · " + getString(R.string.driver_simulating_to_restaurant);
        }
        if (DriverWorkPhaseUtils.AT_RESTAURANT.equals(state.driverWorkPhase)) {
            return coords + " · " + getString(R.string.driver_arrived_restaurant);
        }
        if (DriverWorkPhaseUtils.DELIVERING.equals(state.driverWorkPhase)) {
            return coords + " · " + getString(R.string.driver_simulating_to_customer);
        }
        return coords;
    }

    private int countNearbyOrders(DriverUiState state, boolean isOnline) {
        return resolveNearbyOrders(state, isOnline).size();
    }

    private List<Order> resolveNearbyOrders(DriverUiState state, boolean isOnline) {
        if (!isOnline) {
            return new ArrayList<>();
        }

        List<Order> orders = state.availableOrders;
        if (state.driverLatitude == null || state.driverLongitude == null) {
            return orders;
        }

        List<Order> nearbyOrders = new ArrayList<>();
        for (Order order : orders) {
            if (order.restaurant == null) {
                continue;
            }
            double distanceKm = GeoUtils.distanceKm(
                    state.driverLatitude,
                    state.driverLongitude,
                    order.restaurant.latitude,
                    order.restaurant.longitude
            );
            if (distanceKm <= DriverNearbyOrderUtils.DEFAULT_RADIUS_KM) {
                nearbyOrders.add(order);
            }
        }
        return nearbyOrders;
    }

    private void renderToggleButton(boolean isOnline, boolean busy) {
        binding.buttonToggleReceiving.setEnabled(!busy);
        if (busy && pendingGoOnline) {
            binding.buttonToggleReceiving.setText(R.string.driver_fetching_location);
            binding.buttonToggleReceiving.setBackgroundTintList(
                    ContextCompat.getColorStateList(this, R.color.brand_green));
            return;
        }

        if (isOnline) {
            binding.buttonToggleReceiving.setText(R.string.driver_stop_receiving);
            binding.buttonToggleReceiving.setBackgroundTintList(
                    ContextCompat.getColorStateList(this, android.R.color.darker_gray));
        } else {
            binding.buttonToggleReceiving.setText(R.string.driver_start_receiving);
            binding.buttonToggleReceiving.setBackgroundTintList(
                    ContextCompat.getColorStateList(this, R.color.brand_green));
        }
    }

    private void bindDriverProfile(Driver driver, boolean isOnline) {
        if (driver == null) {
            binding.textDriverName.setText(sessionManager.getUser() != null ? sessionManager.getUser().fullName : "");
            String sessionPhone = sessionManager.getUser() != null ? sessionManager.getUser().phone : "";
            binding.textDriverPhone.setText(getString(R.string.driver_phone_label, safeText(sessionPhone, "-")));
            binding.textDriverRating.setVisibility(View.GONE);
            binding.textDriverVehicle.setText("");
            binding.textDriverAvatarInitial.setText("");
            binding.imageDriverAvatar.setVisibility(View.VISIBLE);
            binding.textDriverOnlineHint.setText(R.string.driver_offline_hint);
            bindStatusChip(false);
            return;
        }

        binding.textDriverName.setText(driver.fullName != null ? driver.fullName : "");
        String phone = safeText(driver.phone,
                sessionManager.getUser() != null ? sessionManager.getUser().phone : "-");
        binding.textDriverPhone.setText(getString(R.string.driver_phone_label, safeText(phone, "-")));
        binding.textDriverRating.setText(getString(
                R.string.driver_rating_label,
                String.format(java.util.Locale.US, "%.1f", driver.ratingAvg)
        ));
        binding.textDriverRating.setVisibility(View.VISIBLE);
        String vehicleInfo = getString(
                R.string.driver_vehicle_detail,
                formatVehicleType(driver.vehicleType),
                safeText(driver.licensePlate, "-")
        );
        binding.textDriverVehicle.setText(vehicleInfo);
        binding.textDriverVehicle.setVisibility(View.VISIBLE);

        String initial = getInitial(driver.fullName);
        binding.textDriverAvatarInitial.setText(initial);
        binding.imageDriverAvatar.setVisibility(initial.isEmpty() ? View.VISIBLE : View.GONE);
        binding.textDriverAvatarInitial.setVisibility(initial.isEmpty() ? View.GONE : View.VISIBLE);

        bindStatusChip(isOnline);
        binding.textDriverOnlineHint.setText(isOnline ? R.string.driver_online_hint : R.string.driver_offline_hint);
    }

    private void bindWorkPhase(DriverUiState state) {
        if (state.driverWorkPhase == null || DriverWorkPhaseUtils.OFFLINE.equals(state.driverWorkPhase)) {
            binding.textDriverWorkPhase.setVisibility(View.GONE);
            return;
        }

        binding.textDriverWorkPhase.setVisibility(View.VISIBLE);
        switch (state.driverWorkPhase) {
            case DriverWorkPhaseUtils.TO_RESTAURANT:
                binding.textDriverWorkPhase.setText(R.string.driver_phase_to_restaurant);
                break;
            case DriverWorkPhaseUtils.AT_RESTAURANT:
                binding.textDriverWorkPhase.setText(R.string.driver_phase_at_restaurant);
                break;
            case DriverWorkPhaseUtils.DELIVERING:
                binding.textDriverWorkPhase.setText(R.string.driver_phase_delivering);
                break;
            case DriverWorkPhaseUtils.IDLE:
            default:
                binding.textDriverWorkPhase.setText(R.string.driver_phase_idle);
                break;
        }
    }

    private void bindListHeader(boolean isOnline, int nearbyCount, boolean isNearbyTab, boolean isCompletedTab, int completedCount) {
        binding.buttonReloadOrders.setVisibility(isNearbyTab ? View.VISIBLE : View.GONE);
        binding.buttonReloadOrders.setEnabled(isOnline && isNearbyTab);

        if (isNearbyTab) {
            binding.textDriverListHeader.setText(isOnline
                    ? getString(R.string.driver_nearby_section_subtitle, nearbyCount)
                    : getString(R.string.driver_nearby_section_title));
        } else if (isCompletedTab) {
            binding.textDriverListHeader.setText(getString(R.string.driver_completed_section_title) + " (" + completedCount + ")");
        } else {
            binding.textDriverListHeader.setText(R.string.driver_active_section_title);
        }
    }

    private void bindStatusChip(boolean isOnline) {
        if (isOnline) {
            binding.textDriverStatus.setText(R.string.driver_status_online);
            binding.textDriverStatus.setBackgroundResource(R.drawable.bg_driver_online);
            binding.textDriverStatus.setTextColor(ContextCompat.getColor(this, R.color.status_done_text));
        } else {
            binding.textDriverStatus.setText(R.string.driver_status_offline);
            binding.textDriverStatus.setBackgroundResource(R.drawable.bg_driver_offline);
            binding.textDriverStatus.setTextColor(ContextCompat.getColor(this, R.color.text_secondary));
        }
    }

    private void updateTabTitles(DriverUiState state, boolean isOnline) {
        if (binding.tabDriverOrders.getTabCount() < 3) {
            return;
        }

        int availableCount = isOnline ? countNearbyOrders(state, isOnline) : 0;
        int activeCount = state.activeOrders.size();
        int completedCount = state.completedOrders.size();

        TabLayout.Tab availableTab = binding.tabDriverOrders.getTabAt(0);
        TabLayout.Tab activeTab = binding.tabDriverOrders.getTabAt(1);
        TabLayout.Tab completedTab = binding.tabDriverOrders.getTabAt(2);
        if (availableTab != null) {
            availableTab.setText(getString(
                    availableCount > 0 ? R.string.driver_tab_available_count : R.string.driver_tab_available,
                    availableCount
            ));
        }
        if (activeTab != null) {
            activeTab.setText(getString(
                    activeCount > 0 ? R.string.driver_tab_active_count : R.string.driver_tab_active,
                    activeCount
            ));
        }
        if (completedTab != null) {
            completedTab.setText(getString(
                    completedCount > 0 ? R.string.driver_tab_completed_count : R.string.driver_tab_completed,
                    completedCount
            ));
        }
    }

    private void syncTabSelection(int selectedTab) {
        TabLayout.Tab tab = binding.tabDriverOrders.getTabAt(selectedTab);
        if (tab != null && !tab.isSelected()) {
            tab.select();
        }
    }

    private String safeText(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private String formatVehicleType(String vehicleType) {
        if (vehicleType == null || vehicleType.trim().isEmpty()) {
            return "Chưa cập nhật";
        }
        String normalized = vehicleType.trim().toUpperCase(java.util.Locale.US);
        if ("MOTORBIKE".equals(normalized) || "MOTO".equals(normalized)) {
            return "Xe máy";
        }
        if ("CAR".equals(normalized)) {
            return "Ô tô";
        }
        if ("BICYCLE".equals(normalized)) {
            return "Xe đạp";
        }
        return vehicleType;
    }

    private String getInitial(String fullName) {
        if (fullName == null || fullName.trim().isEmpty()) {
            return "";
        }
        return fullName.trim().substring(0, 1).toUpperCase();
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.menu_driver_home, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        if (item.getItemId() == R.id.action_logout) {
            logoutDriver();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void redirectToLogin() {
        Intent login = new Intent(this, LoginActivity.class);
        login.putExtra(LoginActivity.EXTRA_LOGIN_ROLE, RoleRouter.ROLE_DRIVER);
        startActivity(login);
        finish();
    }

    @Override
    protected void onDestroy() {
        // Ensure we clean up any service bindings and receivers
        try {
            LocalBroadcastManager.getInstance(this).unregisterReceiver(locationReceiver);
        } catch (IllegalArgumentException ignored) {}
        unbindLocationService();
        super.onDestroy();
    }
}

