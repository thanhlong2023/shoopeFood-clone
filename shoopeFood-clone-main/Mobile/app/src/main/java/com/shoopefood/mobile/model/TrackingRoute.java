package com.shoopefood.mobile.model;

import java.util.List;

public class TrackingRoute {
    public String status;
    public List<TrackingRouteLeg> legs;
    public List<RoutePoint> routePoints;
    public double totalDistanceKm;
    public double totalDurationMinutes;
}
