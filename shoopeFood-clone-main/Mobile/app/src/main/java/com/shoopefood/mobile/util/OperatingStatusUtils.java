package com.shoopefood.mobile.util;

public final class OperatingStatusUtils {

    public static final String OPEN = "OPEN";
    public static final String CLOSED_TODAY = "CLOSED_TODAY";
    public static final String CLOSED = "CLOSED";

    private OperatingStatusUtils() {
    }

    public static String toOperatingStatus(boolean isOpen, boolean isOpenToday) {
        if (!isOpen) {
            return CLOSED;
        }
        if (!isOpenToday) {
            return CLOSED_TODAY;
        }
        return OPEN;
    }

    public static boolean isAcceptingOrders(boolean isOpen, boolean isOpenToday) {
        return isOpen && isOpenToday;
    }

    public static StatusFlags fromOperatingStatus(String status) {
        if (OPEN.equals(status)) {
            return new StatusFlags(true, true);
        }
        if (CLOSED_TODAY.equals(status)) {
            return new StatusFlags(true, false);
        }
        return new StatusFlags(false, false);
    }

    public static String getStatusLabel(boolean isOpen, boolean isOpenToday) {
        if (isAcceptingOrders(isOpen, isOpenToday)) {
            return "Dang nhan don";
        }
        if (!isOpen) {
            return "Tam dong quan";
        }
        return "Nghi hom nay";
    }

    public static class StatusFlags {
        public final boolean isOpen;
        public final boolean isOpenToday;

        public StatusFlags(boolean isOpen, boolean isOpenToday) {
            this.isOpen = isOpen;
            this.isOpenToday = isOpenToday;
        }
    }
}
