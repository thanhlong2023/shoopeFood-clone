package com.shoopefood.mobile.model;

public class ApplicationStatusData {
    public String role;
    public DriverApplicationStatus driver;
    public MerchantApplicationStatus merchant;

    public static class DriverApplicationStatus {
        public String approvalStatus;
        public String rejectReason;
    }

    public static class MerchantApplicationStatus {
        public RestaurantApplicationSummary pendingRestaurant;
        public RestaurantApplicationSummary approvedRestaurant;
    }

    public static class RestaurantApplicationSummary {
        public int id;
        public String name;
        public String approvalStatus;
    }
}
