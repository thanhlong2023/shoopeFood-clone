package com.shoopefood.mobile.model;

import java.util.List;

public class OrderTracking {
    public Order order;
    public Restaurant restaurant;
    public DriverSummary driver;
    public TrackingDriverLocation driverLocation;
    public RoutePoint destination;
    public TrackingRoute route;
    public List<RoutePoint> routePoints;
    public int routeProgress;
}
