package com.shoopefood.mobile.util;

import com.shoopefood.mobile.model.OrderTracking;
import com.shoopefood.mobile.model.RoutePoint;
import com.shoopefood.mobile.model.TrackingDriverLocation;
import com.shoopefood.mobile.model.TrackingRouteLeg;

import java.util.ArrayList;
import java.util.List;

public final class CustomerTrackingRouteUtils {

    private CustomerTrackingRouteUtils() {
    }

    public static List<TrackingRouteLeg> resolveLegs(OrderTracking tracking) {
        if (tracking == null) {
            return new ArrayList<>();
        }

        if (tracking.route != null
                && tracking.route.legs != null
                && hasRenderableGeometry(tracking.route.legs)) {
            return tracking.route.legs;
        }

        return buildFallbackLegs(tracking);
    }

    private static boolean hasRenderableGeometry(List<TrackingRouteLeg> legs) {
        for (TrackingRouteLeg leg : legs) {
            if (leg != null && leg.geometry != null && !leg.geometry.isEmpty()) {
                return true;
            }
        }
        return false;
    }

    private static List<TrackingRouteLeg> buildFallbackLegs(OrderTracking tracking) {
        List<TrackingRouteLeg> legs = new ArrayList<>();

        double restaurantLat = tracking.restaurant != null ? tracking.restaurant.latitude : 0;
        double restaurantLng = tracking.restaurant != null ? tracking.restaurant.longitude : 0;
        double customerLat = tracking.destination != null ? tracking.destination.latitude : 0;
        double customerLng = tracking.destination != null ? tracking.destination.longitude : 0;

        TrackingDriverLocation driverLocation = tracking.driverLocation;
        if (driverLocation != null
                && GeoUtils.isValidCoordinate(driverLocation.latitude, driverLocation.longitude)
                && GeoUtils.isValidCoordinate(restaurantLat, restaurantLng)) {
            TrackingRouteLeg toRestaurant = new TrackingRouteLeg();
            toRestaurant.key = "driver_to_restaurant";
            toRestaurant.label = "Tai xe den nha hang";
            toRestaurant.ok = true;
            toRestaurant.geometry = GeoRouteUtils.buildStraightLine(
                    driverLocation.latitude,
                    driverLocation.longitude,
                    restaurantLat,
                    restaurantLng
            );
            legs.add(toRestaurant);
        }

        if (GeoUtils.isValidCoordinate(restaurantLat, restaurantLng)
                && GeoUtils.isValidCoordinate(customerLat, customerLng)) {
            TrackingRouteLeg toCustomer = new TrackingRouteLeg();
            toCustomer.key = "restaurant_to_customer";
            toCustomer.label = "Nha hang den khach hang";
            toCustomer.ok = true;
            toCustomer.geometry = GeoRouteUtils.buildStraightLine(
                    restaurantLat,
                    restaurantLng,
                    customerLat,
                    customerLng
            );
            legs.add(toCustomer);
        }

        return legs;
    }
}
