package com.shoopefood.mobile.model;

import java.util.List;

public class CreateOrderRequest {
    public int customerId;
    public int restaurantId;
    public String receiverAddress;
    public double receiverLat;
    public double receiverLng;
    public double distanceKm;
    public String shippingType;
    public List<OrderItemRequest> items;

    public CreateOrderRequest(
            int customerId,
            int restaurantId,
            String receiverAddress,
            double receiverLat,
            double receiverLng,
            double distanceKm,
            String shippingType,
            List<OrderItemRequest> items
    ) {
        this.customerId = customerId;
        this.restaurantId = restaurantId;
        this.receiverAddress = receiverAddress;
        this.receiverLat = receiverLat;
        this.receiverLng = receiverLng;
        this.distanceKm = distanceKm;
        this.shippingType = shippingType;
        this.items = items;
    }
}
