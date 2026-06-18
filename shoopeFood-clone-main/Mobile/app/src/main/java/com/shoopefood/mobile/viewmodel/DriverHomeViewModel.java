package com.shoopefood.mobile.viewmodel;

import android.app.Application;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.shoopefood.mobile.R;
import com.shoopefood.mobile.model.Driver;
import com.shoopefood.mobile.model.DriverOrderFeedData;
import com.shoopefood.mobile.model.Order;
import com.shoopefood.mobile.model.RestaurantMapPin;
import com.shoopefood.mobile.model.RoutePoint;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.OsrmRouteClient;
import com.shoopefood.mobile.repository.DriverRepository;
import com.shoopefood.mobile.session.SessionManager;
import com.shoopefood.mobile.util.DriverNearbyOrderUtils;
import com.shoopefood.mobile.util.DriverWorkPhaseUtils;
import com.shoopefood.mobile.util.GeoUtils;
import com.shoopefood.mobile.util.RouteInterpolator;

import java.util.ArrayList;
import java.util.List;

public class DriverHomeViewModel extends AndroidViewModel {

    private static final double MIN_SYNC_DISTANCE_KM = 0.03;
    private static final long MIN_SYNC_INTERVAL_MS = 10_000L;
    private static final long FEED_POLL_INTERVAL_MS = 5_000L;
    private static final int SIMULATION_STEPS = 20;
    private static final long SIMULATION_STEP_MS = 2000L;

    private final DriverRepository repository;
    private final SessionManager sessionManager;
    private final OsrmRouteClient osrmRouteClient;
    private final Handler simulationHandler = new Handler(Looper.getMainLooper());
    private final Handler feedPollHandler = new Handler(Looper.getMainLooper());
    private final MutableLiveData<DriverUiState> uiState = new MutableLiveData<>(DriverUiState.initial());
    private final MutableLiveData<String> toastMessage = new MutableLiveData<>();

    private long lastLocationSyncAtMs = 0L;
    private Double lastSyncedLatitude;
    private Double lastSyncedLongitude;
    private Order deliveryOrder;
    private Runnable simulationRunnable;
    private Runnable feedPollRunnable;
    private boolean feedPollingActive;
    private boolean feedRequestInFlight;
    private List<Order> lastFetchedAvailableOrders = new ArrayList<>();
    private List<RoutePoint> simulationRoute = new ArrayList<>();
    private boolean pendingReloadToast;

    public DriverHomeViewModel(@NonNull Application application) {
        super(application);
        repository = new DriverRepository(ApiClient.getService(application));
        sessionManager = new SessionManager(application);
        osrmRouteClient = new OsrmRouteClient(ApiClient.getService(application));
    }

    public LiveData<DriverUiState> getUiState() {
        return uiState;
    }

    public LiveData<String> getToastMessage() {
        return toastMessage;
    }

    public int getDriverId() {
        return sessionManager.getUser() != null ? sessionManager.getUser().id : -1;
    }

    @Override
    protected void onCleared() {
        stopSimulation();
        stopFeedPolling();
        super.onCleared();
    }

    public void loadFeed() {
        loadFeed(false);
    }

    public void loadFeedQuiet() {
        loadFeed(true);
    }

    public void reloadNearbyOrders() {
        feedRequestInFlight = false;
        pendingReloadToast = true;
        loadFeed(false);
    }

    public void startFeedPolling() {
        DriverUiState state = uiState.getValue();
        if (state == null || state.driver == null || !state.driver.isOnline) {
            return;
        }

        feedPollingActive = true;
        if (feedPollRunnable == null) {
            feedPollRunnable = new Runnable() {
                @Override
                public void run() {
                    if (!feedPollingActive) {
                        return;
                    }

                    DriverUiState current = uiState.getValue();
                    if (current != null
                            && current.driver != null
                            && current.driver.isOnline
                            && !current.simulationRunning) {
                        loadFeedQuiet();
                    }

                    if (feedPollingActive) {
                        feedPollHandler.postDelayed(this, FEED_POLL_INTERVAL_MS);
                    }
                }
            };
        }

        feedPollHandler.removeCallbacks(feedPollRunnable);
        feedPollHandler.post(feedPollRunnable);
    }

    public void stopFeedPolling() {
        feedPollingActive = false;
        if (feedPollRunnable != null) {
            feedPollHandler.removeCallbacks(feedPollRunnable);
        }
    }

    public void refreshFeedIfOnline() {
        DriverUiState state = uiState.getValue();
        if (state == null || state.driver == null || !state.driver.isOnline) {
            return;
        }

        loadFeedQuiet();
        startFeedPolling();
    }

    private void loadFeed(boolean quiet) {
        if (feedRequestInFlight) {
            return;
        }

        DriverUiState current = uiState.getValue();
        if (!quiet) {
            uiState.setValue(current.copy(
                    null, null, null, null, null, null, null, null, true, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null
            ));
        }

        feedRequestInFlight = true;
        repository.loadOrderFeed(new DriverRepository.FeedCallback() {
            @Override
            public void onSuccess(DriverOrderFeedData data) {
                feedRequestInFlight = false;
                DriverUiState latest = uiState.getValue();
                applyFeedData(data, latest.driverLatitude, latest.driverLongitude, latest);
            }

            @Override
            public void onError(String message) {
                feedRequestInFlight = false;
                DriverUiState latest = uiState.getValue();
                uiState.setValue(latest.copy(
                        null, null, null, null, null, null, null, null, false, null, message, null, null,
                        null, null, null, null, null, null, null, null, null, null
                ));
                if (!quiet) {
                    toastMessage.setValue(message);
                }
            }
        });
    }

    private void applyFeedData(
            DriverOrderFeedData data,
            Double latitude,
            Double longitude,
            DriverUiState latest
    ) {
        lastFetchedAvailableOrders = data.available != null
                ? new ArrayList<>(data.available)
                : new ArrayList<>();
        List<Order> nearbyAvailable = DriverNearbyOrderUtils.filterNearbyOrders(
                latitude,
                longitude,
                lastFetchedAvailableOrders,
                DriverNearbyOrderUtils.DEFAULT_RADIUS_KM
        );
        List<RestaurantMapPin> pins = buildNearbyPins(latitude, longitude, nearbyAvailable);

        if (pendingReloadToast) {
            pendingReloadToast = false;
            toastMessage.setValue(getApplication().getString(
                    R.string.driver_reload_success,
                    nearbyAvailable.size()
            ));
        }

        if (latest.simulationRunning || latest.activeDeliveryOrderId > 0 || deliveryOrder != null) {
            uiState.setValue(latest.copy(
                    data.driver,
                    nearbyAvailable,
                    data.active,
                    data.completed,
                    pins,
                    latest.driverLatitude,
                    latest.driverLongitude,
                    null,
                    false,
                    null,
                    null,
                    DriverUiState.NO_ACCEPTING_ORDER,
                    latest.driverWorkPhase,
                    null, null, null, null, null, null, null, null, null, null
            ));
            return;
        }

        String phase = DriverWorkPhaseUtils.resolve(data.driver, data.active);
        uiState.setValue(latest.copy(
                data.driver,
                nearbyAvailable,
                data.active,
                data.completed,
                pins,
                latitude,
                longitude,
                null,
                false,
                null,
                null,
                DriverUiState.NO_ACCEPTING_ORDER,
                phase,
                null, null, null, null, null, null, null, null, null, null
        ));
    }

    public void acceptOrder(int orderId) {
        DriverUiState current = uiState.getValue();
        if (current == null) {
            return;
        }

        if (hasActiveDelivery(current)) {
            toastMessage.setValue(getApplication().getString(R.string.driver_already_has_active_order));
            return;
        }

        Order targetOrder = findAvailableOrder(orderId, current);
        if (targetOrder != null
                && current.driverLatitude != null
                && current.driverLongitude != null
                && !DriverNearbyOrderUtils.isOrderWithinRadius(
                        current.driverLatitude,
                        current.driverLongitude,
                        targetOrder,
                        DriverNearbyOrderUtils.DEFAULT_RADIUS_KM
                )) {
            toastMessage.setValue(getApplication().getString(R.string.driver_order_out_of_radius));
            return;
        }

        uiState.setValue(current.copy(
                null, null, null, null, null, null, null, null, null, true, null,
                orderId,
                DriverWorkPhaseUtils.TO_RESTAURANT,
                null, null, null, null, null, null, null, null, null, null
        ));

        repository.acceptOrder(orderId, new DriverRepository.OrderCallback() {
            @Override
            public void onSuccess(Order order) {
                Order enrichedOrder = enrichAcceptedOrder(order);
                deliveryOrder = enrichedOrder;
                String code = enrichedOrder.orderCode != null ? enrichedOrder.orderCode : String.valueOf(enrichedOrder.id);
                toastMessage.setValue(getApplication().getString(R.string.driver_accept_success, code));

                DriverUiState latest = uiState.getValue();
                if (latest == null) {
                    return;
                }

                double restaurantLat = resolveRestaurantLat(enrichedOrder);
                double restaurantLng = resolveRestaurantLng(enrichedOrder);

                uiState.setValue(latest.copy(
                        null, null, null, null, null, null, null,
                        DriverUiState.TAB_ACTIVE,
                        false,
                        false,
                        null,
                        DriverUiState.NO_ACCEPTING_ORDER,
                        DriverWorkPhaseUtils.TO_RESTAURANT,
                        enrichedOrder.id,
                        resolveRestaurantName(enrichedOrder),
                        restaurantLat,
                        restaurantLng,
                        null,
                        null,
                        new ArrayList<>(),
                        DriverUiState.ROUTE_LEG_TO_RESTAURANT,
                        true,
                        false
                ));

                loadFeed();
            }

            @Override
            public void onError(String message) {
                DriverUiState latest = uiState.getValue();
                String phase = DriverWorkPhaseUtils.resolve(latest.driver, latest.activeOrders);
                uiState.setValue(latest.copy(
                        null, null, null, null, null, null, null, null, false, null, message,
                        DriverUiState.NO_ACCEPTING_ORDER,
                        phase,
                        null, null, null, null, null, null, null, null, null, null
                ));
                toastMessage.setValue(message);
            }
        });
    }

    public void startGoToMerchant() {
        if (deliveryOrder == null) {
            toastMessage.setValue("Khong tim thay don dang giao");
            return;
        }

        DriverUiState current = uiState.getValue();
        if (current == null || current.simulationRunning) {
            return;
        }

        uiState.setValue(current.copy(
                null, null, null, null, null, null, null, null, null, true, null, null,
                DriverWorkPhaseUtils.TO_RESTAURANT,
                null, null, null, null, null, null, null,
                DriverUiState.ROUTE_LEG_TO_RESTAURANT,
                false,
                false
        ));

        repository.updateOrderStatus(
                deliveryOrder.id,
                "PICKING_UP",
                deliveryOrder.version,
                new DriverRepository.OrderCallback() {
                    @Override
                    public void onSuccess(Order order) {
                        deliveryOrder = order;
                        startSimulationToRestaurant(order);
                    }

                    @Override
                    public void onError(String message) {
                        DriverUiState latest = uiState.getValue();
                        uiState.setValue(latest.copy(
                                null, null, null, null, null, null, null, null, false, null, message, null,
                                DriverWorkPhaseUtils.TO_RESTAURANT,
                                null, null, null, null, null, null, null, null, true, null
                        ));
                        toastMessage.setValue(message);
                    }
                }
        );
    }

    public void startDeliverToCustomer() {
        if (deliveryOrder == null || deliveryOrder.restaurant == null) {
            toastMessage.setValue("Khong tim thay don dang giao");
            return;
        }

        DriverUiState current = uiState.getValue();
        if (current == null || current.simulationRunning) {
            return;
        }

        double[] customer = resolveCustomerPoint(deliveryOrder);
        uiState.setValue(current.copy(
                null, null, null, null, null, null, null, null, null, true, null, null,
                DriverWorkPhaseUtils.DELIVERING,
                null, null, null, null,
                customer[0],
                customer[1],
                null,
                DriverUiState.ROUTE_LEG_TO_CUSTOMER,
                false,
                false
        ));

        repository.updateOrderStatus(
                deliveryOrder.id,
                "DELIVERING",
                deliveryOrder.version,
                new DriverRepository.OrderCallback() {
                    @Override
                    public void onSuccess(Order order) {
                        deliveryOrder = order;
                        fetchAndSimulateToCustomer(customer[0], customer[1]);
                    }

                    @Override
                    public void onError(String message) {
                        DriverUiState latest = uiState.getValue();
                        uiState.setValue(latest.copy(
                                null, null, null, null, null, null, null, null, false, null, message, null,
                                DriverWorkPhaseUtils.AT_RESTAURANT,
                                null, null, null, null, null, null, null, null, false, null
                        ));
                        toastMessage.setValue(message);
                    }
                }
        );
    }

    private void startSimulationToRestaurant(Order order) {
        DriverUiState state = uiState.getValue();
        if (state == null || state.driverLatitude == null || state.driverLongitude == null) {
            toastMessage.setValue("Chua co vi tri de mo phong lo trinh");
            return;
        }

        double restaurantLat = resolveRestaurantLat(order);
        double restaurantLng = resolveRestaurantLng(order);
        if (!GeoUtils.isValidCoordinate(restaurantLat, restaurantLng)) {
            toastMessage.setValue("Don khong co toa do nha hang");
            return;
        }

        toastMessage.setValue(getApplication().getString(R.string.driver_fetching_route));

        final double fromLat = state.driverLatitude;
        final double fromLng = state.driverLongitude;
        osrmRouteClient.fetchDrivingRoute(
                fromLat,
                fromLng,
                restaurantLat,
                restaurantLng,
                new OsrmRouteClient.RouteCallback() {
                    @Override
                    public void onSuccess(List<RoutePoint> points) {
                        DriverUiState latest = uiState.getValue();
                        if (latest == null || deliveryOrder == null || deliveryOrder.id != order.id) {
                            return;
                        }

                        toastMessage.setValue(getApplication().getString(R.string.driver_simulating_to_restaurant));
                        beginRouteSimulation(
                                order,
                                points,
                                restaurantLat,
                                restaurantLng,
                                DriverWorkPhaseUtils.TO_RESTAURANT,
                                DriverUiState.ROUTE_LEG_TO_RESTAURANT,
                                () -> {
                                    DriverUiState arrived = uiState.getValue();
                                    if (arrived == null) {
                                        return;
                                    }
                                    RoutePoint end = simulationRoute.isEmpty()
                                            ? new RoutePoint(restaurantLat, restaurantLng)
                                            : simulationRoute.get(simulationRoute.size() - 1);

                                    DriverUiState latest = uiState.getValue();
                                    if (latest != null) {
                                        uiState.setValue(latest.copy(
                                                null, null, null, null, null, end.latitude, end.longitude, null, null, null, null, null,
                                                DriverWorkPhaseUtils.AT_RESTAURANT,
                                                null, null, null, null, null, null, simulationRoute,
                                                DriverUiState.ROUTE_LEG_TO_RESTAURANT,
                                                true,
                                                false
                                        ));
                                    }
                                    toastMessage.setValue(getApplication().getString(R.string.driver_arrived_restaurant));
                                }
                        );
                    }

                    @Override
                    public void onError(String message) {
                        toastMessage.setValue(message);
                    }
                }
        );
    }

    private void fetchAndSimulateToCustomer(double customerLat, double customerLng) {
        if (deliveryOrder == null) {
            return;
        }

        double restaurantLat = resolveRestaurantLat(deliveryOrder);
        double restaurantLng = resolveRestaurantLng(deliveryOrder);
        if (!GeoUtils.isValidCoordinate(restaurantLat, restaurantLng)) {
            toastMessage.setValue("Khong tim thay toa do nha hang");
            return;
        }

        toastMessage.setValue(getApplication().getString(R.string.driver_fetching_route));

        final Order activeOrder = deliveryOrder;
        osrmRouteClient.fetchDrivingRoute(
                restaurantLat,
                restaurantLng,
                customerLat,
                customerLng,
                new OsrmRouteClient.RouteCallback() {
                    @Override
                    public void onSuccess(List<RoutePoint> points) {
                        if (deliveryOrder == null || deliveryOrder.id != activeOrder.id) {
                            return;
                        }

                        toastMessage.setValue(getApplication().getString(R.string.driver_simulating_to_customer));
                        beginRouteSimulation(
                                activeOrder,
                                points,
                                customerLat,
                                customerLng,
                                DriverWorkPhaseUtils.DELIVERING,
                                DriverUiState.ROUTE_LEG_TO_CUSTOMER,
                                () -> completeDelivery(customerLat, customerLng)
                        );
                    }

                    @Override
                    public void onError(String message) {
                        toastMessage.setValue(message);
                    }
                }
        );
    }

    private void beginRouteSimulation(
            Order order,
            List<RoutePoint> route,
            double destinationLat,
            double destinationLng,
            String phase,
            String routeLeg,
            Runnable onComplete
    ) {
        DriverUiState latest = uiState.getValue();
        if (latest == null || route == null || route.isEmpty()) {
            return;
        }

        RoutePoint start = route.get(0);
        uiState.setValue(latest.copy(
                null, null, null, null, null,
                start.latitude,
                start.longitude,
                null, null, null, null, null,
                phase,
                order.id,
                resolveRestaurantName(order),
                resolveRestaurantLat(order),
                resolveRestaurantLng(order),
                DriverUiState.ROUTE_LEG_TO_CUSTOMER.equals(routeLeg) ? destinationLat : null,
                DriverUiState.ROUTE_LEG_TO_CUSTOMER.equals(routeLeg) ? destinationLng : null,
                route,
                routeLeg,
                false,
                true
        ));
        runRouteSimulation(route, phase, onComplete);
    }

    private void completeDelivery(double customerLat, double customerLng) {
        if (deliveryOrder == null) {
            clearDeliveryState();
            return;
        }

        repository.updateOrderStatus(
                deliveryOrder.id,
                "COMPLETED",
                deliveryOrder.version,
                new DriverRepository.OrderCallback() {
                    @Override
                    public void onSuccess(Order order) {
                        toastMessage.setValue(getApplication().getString(
                                R.string.driver_delivery_completed,
                                order.orderCode != null ? order.orderCode : String.valueOf(order.id)
                        ));
                        deliveryOrder = null;
                        DriverUiState latest = uiState.getValue();
                        if (latest != null) {
                            uiState.setValue(latest.copy(
                                    null, null, null, null, null, customerLat, customerLng, null, null, null, null, null,
                                    DriverWorkPhaseUtils.IDLE,
                                    DriverUiState.NO_DELIVERY_ORDER,
                                    "",
                                    0d,
                                    0d,
                                    null,
                                    null,
                                    new ArrayList<>(),
                                    null,
                                    false,
                                    false
                            ));
                        }
                        loadFeed();
                    }

                    @Override
                    public void onError(String message) {
                        toastMessage.setValue(message);
                    }
                }
        );
    }

    private void clearDeliveryState() {
        deliveryOrder = null;
        DriverUiState latest = uiState.getValue();
        if (latest == null) {
            return;
        }
        uiState.setValue(latest.copy(
                null, null, null, null, null, null, null, null, null, null, null, null,
                DriverWorkPhaseUtils.IDLE,
                DriverUiState.NO_DELIVERY_ORDER,
                "",
                0d,
                0d,
                null,
                null,
                new ArrayList<>(),
                null,
                false,
                false
        ));
    }

    private void runRouteSimulation(List<RoutePoint> route, String phase, Runnable onComplete) {
        stopSimulation();
        simulationRoute = route != null ? new ArrayList<>(route) : new ArrayList<>();
        
        double distanceKm = 0.0;
        if (route != null) {
            for (int i = 1; i < route.size(); i++) {
                RoutePoint prev = route.get(i - 1);
                RoutePoint curr = route.get(i);
                distanceKm += GeoUtils.distanceKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
            }
        }
        
        // 10 seconds per 1 km = 10000 ms per km
        double totalTimeMs = distanceKm * 10000.0;
        if (totalTimeMs < 2000.0) {
            totalTimeMs = 2000.0; // Minimum 2 seconds
        }
        final int totalSteps = (int) (totalTimeMs / SIMULATION_STEP_MS);
        final int[] step = {0};

        simulationRunnable = new Runnable() {
            @Override
            public void run() {
                DriverUiState current = uiState.getValue();
                if (current == null || simulationRoute.isEmpty()) {
                    return;
                }

                double fraction = step[0] / (double) totalSteps;
                RoutePoint point = RouteInterpolator.pointAtFraction(simulationRoute, fraction);
                uiState.setValue(current.copy(
                        null, null, null, null, null,
                        point.latitude,
                        point.longitude,
                        null, null, null, null, null,
                        phase,
                        null, null, null, null, null, null, simulationRoute, current.routeLeg, null, true
                ));

                repository.pushLocation(getDriverId(), point.latitude, point.longitude, current.activeDeliveryOrderId);

                if (step[0] >= totalSteps) {
                    stopSimulation();
                    if (onComplete != null) {
                        onComplete.run();
                    }
                    return;
                }

                step[0]++;
                simulationHandler.postDelayed(this, SIMULATION_STEP_MS);
            }
        };

        simulationHandler.post(simulationRunnable);
    }

    private Order enrichAcceptedOrder(Order order) {
        if (order == null) {
            return null;
        }
        if (order.restaurant != null
                && GeoUtils.isValidCoordinate(order.restaurant.latitude, order.restaurant.longitude)) {
            return order;
        }

        DriverUiState state = uiState.getValue();
        if (state == null) {
            return order;
        }

        for (Order candidate : state.availableOrders) {
            if (candidate.id != order.id || candidate.restaurant == null) {
                continue;
            }
            order.restaurant = candidate.restaurant;
            return order;
        }

        for (Order candidate : state.activeOrders) {
            if (candidate.id != order.id || candidate.restaurant == null) {
                continue;
            }
            order.restaurant = candidate.restaurant;
            return order;
        }

        return order;
    }

    private void stopSimulation() {
        if (simulationRunnable != null) {
            simulationHandler.removeCallbacks(simulationRunnable);
            simulationRunnable = null;
        }
    }

    public void applyGpsLocation(double latitude, double longitude, float accuracyMeters) {
        DriverUiState current = uiState.getValue();
        if (current == null || current.driver == null || !current.driver.isOnline || current.simulationRunning) {
            return;
        }

        List<Order> nearbyAvailable = DriverNearbyOrderUtils.filterNearbyOrders(
                latitude,
                longitude,
                lastFetchedAvailableOrders,
                DriverNearbyOrderUtils.DEFAULT_RADIUS_KM
        );
        List<RestaurantMapPin> pins = buildNearbyPins(latitude, longitude, nearbyAvailable);
        uiState.setValue(current.copy(
                null, nearbyAvailable, null, null, pins, latitude, longitude, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null
        ));

        maybeSyncLocationToServer(latitude, longitude);
    }

    private boolean hasActiveDelivery(DriverUiState state) {
        if (state == null) {
            return false;
        }
        if (deliveryOrder != null || state.activeDeliveryOrderId > 0 || state.simulationRunning) {
            return true;
        }
        return state.activeOrders != null && !state.activeOrders.isEmpty();
    }

    private Order findAvailableOrder(int orderId, DriverUiState state) {
        if (state == null || state.availableOrders == null) {
            return null;
        }
        for (Order order : state.availableOrders) {
            if (order.id == orderId) {
                return order;
            }
        }
        for (Order order : lastFetchedAvailableOrders) {
            if (order.id == orderId) {
                return order;
            }
        }
        return null;
    }

    private void maybeSyncLocationToServer(double latitude, double longitude) {
        long now = System.currentTimeMillis();
        boolean movedEnough = lastSyncedLatitude == null
                || lastSyncedLongitude == null
                || GeoUtils.distanceKm(lastSyncedLatitude, lastSyncedLongitude, latitude, longitude) >= MIN_SYNC_DISTANCE_KM;
        boolean waitedEnough = now - lastLocationSyncAtMs >= MIN_SYNC_INTERVAL_MS;

        if (!movedEnough && !waitedEnough) {
            return;
        }

        int driverId = getDriverId();
        if (driverId <= 0) {
            return;
        }

        lastLocationSyncAtMs = now;
        lastSyncedLatitude = latitude;
        lastSyncedLongitude = longitude;
        DriverUiState state = uiState.getValue();
        Integer activeOrderId = (state != null && state.activeDeliveryOrderId > 0) ? state.activeDeliveryOrderId : null;
        repository.pushLocation(driverId, latitude, longitude, activeOrderId);
    }

    public void selectTab(int tab) {
        DriverUiState current = uiState.getValue();
        uiState.setValue(current.copy(
                null, null, null, null, null, null, null, tab, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null
        ));
    }

    public void goOnline(double latitude, double longitude) {
        int driverId = getDriverId();
        if (driverId <= 0) {
            toastMessage.setValue("Khong tim thay tai khoan tai xe");
            return;
        }

        DriverUiState current = uiState.getValue();
        uiState.setValue(current.copy(
                null, null, null, null, null, latitude, longitude, null, null, true, null, null, DriverWorkPhaseUtils.IDLE,
                null, null, null, null, null, null, null, null, null, null
        ));

        repository.goOnline(driverId, latitude, longitude, new DriverRepository.DriverCallback() {
            @Override
            public void onSuccess(Driver driver) {
                DriverUiState latest = uiState.getValue();
                lastLocationSyncAtMs = System.currentTimeMillis();
                lastSyncedLatitude = latitude;
                lastSyncedLongitude = longitude;
                uiState.setValue(latest.copy(
                        driver, null, null, null, null, latitude, longitude, null, null, false, null, null, DriverWorkPhaseUtils.IDLE,
                        null, null, null, null, null, null, null, null, null, null
                ));
                toastMessage.setValue("Da bat nhan don. Vi tri da duoc cap nhat.");
                loadFeed();
                startFeedPolling();
            }

            @Override
            public void onError(String message) {
                DriverUiState latest = uiState.getValue();
                uiState.setValue(new DriverUiState(
                        latest.driver,
                        latest.availableOrders,
                        latest.activeOrders,
                        latest.completedOrders,
                        latest.nearbyRestaurantPins,
                        null,
                        null,
                        latest.selectedTab,
                        false,
                        false,
                        message,
                        DriverUiState.NO_ACCEPTING_ORDER,
                        DriverWorkPhaseUtils.OFFLINE,
                        DriverUiState.NO_DELIVERY_ORDER,
                        "",
                        0,
                        0,
                        null,
                        null,
                        new ArrayList<>(),
                        null,
                        false,
                        false
                ));
                toastMessage.setValue(message);
            }
        });
    }

    public void goOffline() {
        int driverId = getDriverId();
        if (driverId <= 0) {
            toastMessage.setValue("Khong tim thay tai khoan tai xe");
            return;
        }

        stopSimulation();
        stopFeedPolling();
        deliveryOrder = null;

        DriverUiState current = uiState.getValue();
        uiState.setValue(current.copy(
                null, null, null, null, new ArrayList<>(), null, null, null, null, true, null, null, DriverWorkPhaseUtils.OFFLINE,
                DriverUiState.NO_DELIVERY_ORDER, "", 0d, 0d, null, null, new ArrayList<>(), null, false, false
        ));

        repository.goOffline(driverId, new DriverRepository.DriverCallback() {
            @Override
            public void onSuccess(Driver driver) {
                DriverUiState latest = uiState.getValue();
                lastLocationSyncAtMs = 0L;
                lastSyncedLatitude = null;
                lastSyncedLongitude = null;
                uiState.setValue(new DriverUiState(
                        driver,
                        latest.availableOrders,
                        latest.activeOrders,
                        latest.completedOrders,
                        new ArrayList<>(),
                        null,
                        null,
                        latest.selectedTab,
                        false,
                        false,
                        null,
                        DriverUiState.NO_ACCEPTING_ORDER,
                        DriverWorkPhaseUtils.OFFLINE,
                        DriverUiState.NO_DELIVERY_ORDER,
                        "",
                        0,
                        0,
                        null,
                        null,
                        new ArrayList<>(),
                        null,
                        false,
                        false
                ));
                toastMessage.setValue("Da tat nhan don. Ban se khong nhan don moi.");
                loadFeed();
            }

            @Override
            public void onError(String message) {
                DriverUiState latest = uiState.getValue();
                uiState.setValue(latest.copy(
                        null, null, null, null, null, null, null, null, null, false, message, null, null,
                        null, null, null, null, null, null, null, null, null, null
                ));
                toastMessage.setValue(message);
            }
        });
    }

    private List<RestaurantMapPin> buildNearbyPins(Double lat, Double lng, List<Order> availableOrders) {
        if (lat == null || lng == null) {
            return new ArrayList<>();
        }
        return DriverNearbyOrderUtils.buildNearbyRestaurantPins(
                lat,
                lng,
                availableOrders,
                DriverNearbyOrderUtils.DEFAULT_RADIUS_KM
        );
    }

    private String resolveRestaurantName(Order order) {
        return order.restaurant != null && order.restaurant.name != null
                ? order.restaurant.name
                : "Nha hang";
    }

    private double resolveRestaurantLat(Order order) {
        return order.restaurant != null ? order.restaurant.latitude : 0;
    }

    private double resolveRestaurantLng(Order order) {
        return order.restaurant != null ? order.restaurant.longitude : 0;
    }

    private double[] resolveCustomerPoint(Order order) {
        if (order.receiverLat != null
                && order.receiverLng != null
                && GeoUtils.isValidCoordinate(order.receiverLat, order.receiverLng)) {
            return new double[]{order.receiverLat, order.receiverLng};
        }
        if (order.restaurant != null) {
            return GeoUtils.offsetKm(order.restaurant.latitude, order.restaurant.longitude, 2.0, 35);
        }
        DriverUiState state = uiState.getValue();
        if (state != null && state.driverLatitude != null && state.driverLongitude != null) {
            return GeoUtils.offsetKm(state.driverLatitude, state.driverLongitude, 2.0, 35);
        }
        return new double[]{10.7769, 106.7009};
    }
}
