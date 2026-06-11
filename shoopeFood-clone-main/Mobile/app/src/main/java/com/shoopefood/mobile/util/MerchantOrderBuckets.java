package com.shoopefood.mobile.util;

import com.shoopefood.mobile.model.Order;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class MerchantOrderBuckets {

    public static final int TAB_WAITING = 0;
    public static final int TAB_COOKING = 1;
    public static final int TAB_DONE = 2;

    private static final Set<String> WAITING_CODES = new HashSet<>(Arrays.asList(
            "PENDING", "DRIVER_ACCEPTED"
    ));
    private static final Set<String> COOKING_CODES = new HashSet<>(Arrays.asList(
            "CONFIRMED", "PICKING_UP", "DELIVERING"
    ));
    private static final Set<String> DONE_CODES = new HashSet<>(Arrays.asList(
            "COMPLETED"
    ));

    private MerchantOrderBuckets() {
    }

    public static List<Order> filter(List<Order> orders, int tab) {
        List<Order> result = new ArrayList<>();
        if (orders == null) {
            return result;
        }
        for (Order order : orders) {
            if (belongsToTab(order, tab)) {
                result.add(order);
            }
        }
        return result;
    }

    public static boolean belongsToTab(Order order, int tab) {
        if (order == null || order.statusCode == null) {
            return false;
        }
        switch (tab) {
            case TAB_WAITING:
                return WAITING_CODES.contains(order.statusCode);
            case TAB_COOKING:
                return COOKING_CODES.contains(order.statusCode);
            case TAB_DONE:
                return DONE_CODES.contains(order.statusCode);
            default:
                return false;
        }
    }

    public static int count(List<Order> orders, int tab) {
        return filter(orders, tab).size();
    }

    public static String getNextStatusForCookingAction(String currentStatusCode) {
        if ("CONFIRMED".equals(currentStatusCode)) {
            return "PICKING_UP";
        }
        return null;
    }

    public static boolean canConfirm(String statusCode) {
        return WAITING_CODES.contains(statusCode);
    }

    public static boolean canReject(String statusCode) {
        return WAITING_CODES.contains(statusCode);
    }

    public static boolean canMarkReady(String statusCode) {
        return "CONFIRMED".equals(statusCode);
    }
}
