package com.shoopefood.mobile.util;

import com.shoopefood.mobile.model.Driver;
import com.shoopefood.mobile.model.Order;

import java.util.List;

public final class DriverWorkPhaseUtils {

    public static final String OFFLINE = "OFFLINE";
    public static final String IDLE = "IDLE";
    public static final String TO_RESTAURANT = "TO_RESTAURANT";
    public static final String AT_RESTAURANT = "AT_RESTAURANT";
    public static final String DELIVERING = "DELIVERING";

    private DriverWorkPhaseUtils() {
    }

    public static String resolve(Driver driver, List<Order> activeOrders) {
        if (driver == null || !driver.isOnline) {
            return OFFLINE;
        }
        if (activeOrders == null || activeOrders.isEmpty()) {
            return IDLE;
        }

        Order current = activeOrders.get(0);
        if (current.statusCode == null) {
            return IDLE;
        }

        switch (current.statusCode) {
            case "DRIVER_ACCEPTED":
                return TO_RESTAURANT;
            case "CONFIRMED":
            case "PICKING_UP":
                return AT_RESTAURANT;
            case "DELIVERING":
                return DELIVERING;
            default:
                return IDLE;
        }
    }
}
