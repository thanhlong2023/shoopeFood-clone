package com.shoopefood.mobile.viewmodel;

import com.shoopefood.mobile.model.Driver;
import com.shoopefood.mobile.model.Order;
import com.shoopefood.mobile.model.RestaurantMapPin;
import com.shoopefood.mobile.model.RoutePoint;

import java.util.ArrayList;
import java.util.List;

public class DriverUiState {

    public static final int TAB_AVAILABLE = 0;
    public static final int TAB_ACTIVE = 1;
    public static final int TAB_COMPLETED = 2;
    public static final int NO_ACCEPTING_ORDER = -1;
    public static final int NO_DELIVERY_ORDER = -1;

    public static final String ROUTE_LEG_TO_RESTAURANT = "TO_RESTAURANT";
    public static final String ROUTE_LEG_TO_CUSTOMER = "TO_CUSTOMER";

    public final Driver driver;
    public final List<Order> availableOrders;
    public final List<Order> activeOrders;
    public final List<Order> completedOrders;
    public final List<RestaurantMapPin> nearbyRestaurantPins;
    public final Double driverLatitude;
    public final Double driverLongitude;
    public final int selectedTab;
    public final boolean loading;
    public final boolean statusUpdating;
    public final String errorMessage;
    public final int acceptingOrderId;
    public final String driverWorkPhase;

    public final int activeDeliveryOrderId;
    public final String activeRestaurantName;
    public final double activeRestaurantLat;
    public final double activeRestaurantLng;
    public final Double customerLatitude;
    public final Double customerLongitude;
    public final List<RoutePoint> routePolyline;
    public final String routeLeg;
    public final boolean showDeliverToCustomerButton;
    public final boolean simulationRunning;

    public DriverUiState(
            Driver driver,
            List<Order> availableOrders,
            List<Order> activeOrders,
            List<Order> completedOrders,
            List<RestaurantMapPin> nearbyRestaurantPins,
            Double driverLatitude,
            Double driverLongitude,
            int selectedTab,
            boolean loading,
            boolean statusUpdating,
            String errorMessage,
            int acceptingOrderId,
            String driverWorkPhase,
            int activeDeliveryOrderId,
            String activeRestaurantName,
            double activeRestaurantLat,
            double activeRestaurantLng,
            Double customerLatitude,
            Double customerLongitude,
            List<RoutePoint> routePolyline,
            String routeLeg,
            boolean showDeliverToCustomerButton,
            boolean simulationRunning
    ) {
        this.driver = driver;
        this.availableOrders = availableOrders != null ? availableOrders : new ArrayList<>();
        this.activeOrders = activeOrders != null ? activeOrders : new ArrayList<>();
        this.completedOrders = completedOrders != null ? completedOrders : new ArrayList<>();
        this.nearbyRestaurantPins = nearbyRestaurantPins != null ? nearbyRestaurantPins : new ArrayList<>();
        this.driverLatitude = driverLatitude;
        this.driverLongitude = driverLongitude;
        this.selectedTab = selectedTab;
        this.loading = loading;
        this.statusUpdating = statusUpdating;
        this.errorMessage = errorMessage;
        this.acceptingOrderId = acceptingOrderId;
        this.driverWorkPhase = driverWorkPhase;
        this.activeDeliveryOrderId = activeDeliveryOrderId;
        this.activeRestaurantName = activeRestaurantName != null ? activeRestaurantName : "";
        this.activeRestaurantLat = activeRestaurantLat;
        this.activeRestaurantLng = activeRestaurantLng;
        this.customerLatitude = customerLatitude;
        this.customerLongitude = customerLongitude;
        this.routePolyline = routePolyline != null ? routePolyline : new ArrayList<>();
        this.routeLeg = routeLeg;
        this.showDeliverToCustomerButton = showDeliverToCustomerButton;
        this.simulationRunning = simulationRunning;
    }

    public static DriverUiState initial() {
        return new DriverUiState(
                null, new ArrayList<>(), new ArrayList<>(), new ArrayList<>(), new ArrayList<>(),
                null, null, TAB_AVAILABLE, false, false, null,
                NO_ACCEPTING_ORDER, null,
                NO_DELIVERY_ORDER, "", 0, 0, null, null, new ArrayList<>(), null, false, false
        );
    }

    public List<Order> getVisibleOrders() {
        if (selectedTab == TAB_ACTIVE) {
            return activeOrders;
        }
        if (selectedTab == TAB_COMPLETED) {
            return completedOrders;
        }
        return availableOrders;
    }

    public boolean hasActiveDeliveryMap() {
        return activeDeliveryOrderId > 0 && !routePolyline.isEmpty();
    }

    public DriverUiState copy(
            Driver driver,
            List<Order> availableOrders,
            List<Order> activeOrders,
            List<Order> completedOrders,
            List<RestaurantMapPin> nearbyRestaurantPins,
            Double driverLatitude,
            Double driverLongitude,
            Integer selectedTab,
            Boolean loading,
            Boolean statusUpdating,
            String errorMessage,
            Integer acceptingOrderId,
            String driverWorkPhase,
            Integer activeDeliveryOrderId,
            String activeRestaurantName,
            Double activeRestaurantLat,
            Double activeRestaurantLng,
            Double customerLatitude,
            Double customerLongitude,
            List<RoutePoint> routePolyline,
            String routeLeg,
            Boolean showDeliverToCustomerButton,
            Boolean simulationRunning
    ) {
        return new DriverUiState(
                driver != null ? driver : this.driver,
                availableOrders != null ? availableOrders : this.availableOrders,
                activeOrders != null ? activeOrders : this.activeOrders,
                completedOrders != null ? completedOrders : this.completedOrders,
                nearbyRestaurantPins != null ? nearbyRestaurantPins : this.nearbyRestaurantPins,
                driverLatitude != null ? driverLatitude : this.driverLatitude,
                driverLongitude != null ? driverLongitude : this.driverLongitude,
                selectedTab != null ? selectedTab : this.selectedTab,
                loading != null ? loading : this.loading,
                statusUpdating != null ? statusUpdating : this.statusUpdating,
                errorMessage,
                acceptingOrderId != null ? acceptingOrderId : this.acceptingOrderId,
                driverWorkPhase != null ? driverWorkPhase : this.driverWorkPhase,
                activeDeliveryOrderId != null ? activeDeliveryOrderId : this.activeDeliveryOrderId,
                activeRestaurantName != null ? activeRestaurantName : this.activeRestaurantName,
                activeRestaurantLat != null ? activeRestaurantLat : this.activeRestaurantLat,
                activeRestaurantLng != null ? activeRestaurantLng : this.activeRestaurantLng,
                customerLatitude != null ? customerLatitude : this.customerLatitude,
                customerLongitude != null ? customerLongitude : this.customerLongitude,
                routePolyline != null ? routePolyline : this.routePolyline,
                routeLeg != null ? routeLeg : this.routeLeg,
                showDeliverToCustomerButton != null ? showDeliverToCustomerButton : this.showDeliverToCustomerButton,
                simulationRunning != null ? simulationRunning : this.simulationRunning
        );
    }
}
