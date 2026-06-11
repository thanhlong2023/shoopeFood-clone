package com.shoopefood.mobile.util;

import com.shoopefood.mobile.model.Order;
import com.shoopefood.mobile.model.OrderRestaurantSummary;
import com.shoopefood.mobile.model.RestaurantMapPin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class DriverNearbyOrderUtils {

    public static final double DEFAULT_RADIUS_KM = 10.0;

    private DriverNearbyOrderUtils() {
    }

    public static List<Order> filterNearbyOrders(
            Double driverLat,
            Double driverLng,
            List<Order> availableOrders,
            double radiusKm
    ) {
        List<Order> nearbyOrders = new ArrayList<>();
        if (availableOrders == null
                || driverLat == null
                || driverLng == null
                || !GeoUtils.isValidCoordinate(driverLat, driverLng)) {
            return nearbyOrders;
        }

        for (Order order : availableOrders) {
            OrderRestaurantSummary restaurant = order.restaurant;
            if (restaurant == null || !GeoUtils.isValidCoordinate(restaurant.latitude, restaurant.longitude)) {
                continue;
            }

            double distanceKm = GeoUtils.distanceKm(
                    driverLat,
                    driverLng,
                    restaurant.latitude,
                    restaurant.longitude
            );
            if (distanceKm <= radiusKm) {
                nearbyOrders.add(order);
            }
        }
        return nearbyOrders;
    }

    public static boolean isOrderWithinRadius(
            double driverLat,
            double driverLng,
            Order order,
            double radiusKm
    ) {
        if (order == null || order.restaurant == null) {
            return false;
        }
        if (!GeoUtils.isValidCoordinate(driverLat, driverLng)
                || !GeoUtils.isValidCoordinate(order.restaurant.latitude, order.restaurant.longitude)) {
            return false;
        }
        return GeoUtils.distanceKm(
                driverLat,
                driverLng,
                order.restaurant.latitude,
                order.restaurant.longitude
        ) <= radiusKm;
    }

    public static List<RestaurantMapPin> buildNearbyRestaurantPins(
            double driverLat,
            double driverLng,
            List<Order> availableOrders,
            double radiusKm
    ) {
        Map<Integer, RestaurantMapPin> pinByRestaurant = new HashMap<>();
        if (availableOrders == null || !GeoUtils.isValidCoordinate(driverLat, driverLng)) {
            return new ArrayList<>();
        }

        for (Order order : availableOrders) {
            OrderRestaurantSummary restaurant = order.restaurant;
            if (restaurant == null || !GeoUtils.isValidCoordinate(restaurant.latitude, restaurant.longitude)) {
                continue;
            }

            double distanceKm = GeoUtils.distanceKm(
                    driverLat,
                    driverLng,
                    restaurant.latitude,
                    restaurant.longitude
            );
            if (distanceKm > radiusKm) {
                continue;
            }

            RestaurantMapPin pin = pinByRestaurant.get(restaurant.id);
            if (pin == null) {
                pin = new RestaurantMapPin();
                pin.restaurantId = restaurant.id;
                pin.name = restaurant.name;
                pin.address = restaurant.address;
                pin.latitude = restaurant.latitude;
                pin.longitude = restaurant.longitude;
                pin.distanceKm = distanceKm;
                pin.orderCount = 0;
                pinByRestaurant.put(restaurant.id, pin);
            } else {
                pin.distanceKm = Math.min(pin.distanceKm, distanceKm);
            }

            pin.orderCount += 1;
            if (order.orderCode != null) {
                pin.orderCodes.add(order.orderCode);
            }
        }

        List<RestaurantMapPin> result = new ArrayList<>(pinByRestaurant.values());
        result.sort((left, right) -> Double.compare(left.distanceKm, right.distanceKm));
        return result;
    }
}
