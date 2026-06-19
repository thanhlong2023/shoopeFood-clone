package com.shoopefood.mobile.model;

public class ReviewRequest {
    public int orderId;
    public String targetType;
    public int rating;
    public String comment;

    public ReviewRequest(int orderId, String targetType, int rating, String comment) {
        this.orderId = orderId;
        this.targetType = targetType;
        this.rating = rating;
        this.comment = comment;
    }
}
