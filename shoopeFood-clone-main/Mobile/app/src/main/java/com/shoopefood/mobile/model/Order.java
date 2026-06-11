package com.shoopefood.mobile.model;

import java.util.List;

public class Order {
    public int id;
    public String orderCode;
    public int customerId;
    public int restaurantId;
    public OrderRestaurantSummary restaurant;
    public String receiverAddress;
    public Double receiverLat;
    public Double receiverLng;
    public double distanceKm;
    public double subtotalAmount;
    public double taxAmount;
    public double discountAmount;
    public double shippingFee;
    public double totalAmount;
    public double cashToCollect;
    public String statusCode;
    public String statusLabel;
    public DriverSummary driver;
    public List<OrderItem> items;
    public int version;
    public String createdAt;
}
