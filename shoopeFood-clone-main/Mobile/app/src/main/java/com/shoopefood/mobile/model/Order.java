package com.shoopefood.mobile.model;

import java.util.List;

public class Order {
    public int id;
    public String orderCode;
    public int customerId;
    public int restaurantId;
    public String receiverAddress;
    public double distanceKm;
    public double subtotalAmount;
    public double taxAmount;
    public double discountAmount;
    public double shippingFee;
    public double totalAmount;
    public String statusCode;
    public String statusLabel;
    public List<OrderItem> items;
    public int version;
    public String createdAt;
}
