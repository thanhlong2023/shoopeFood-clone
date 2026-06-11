package com.shoopefood.mobile.model;

import java.util.ArrayList;
import java.util.List;

public class RestaurantMapPin {
    public int restaurantId;
    public String name;
    public String address;
    public double latitude;
    public double longitude;
    public double distanceKm;
    public int orderCount;
    public final List<String> orderCodes = new ArrayList<>();
}
