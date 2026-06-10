package com.shoopefood.mobile.model;

public class OrderItemRequest {
    public int foodId;
    public int quantity;

    public OrderItemRequest(int foodId, int quantity) {
        this.foodId = foodId;
        this.quantity = quantity;
    }
}
