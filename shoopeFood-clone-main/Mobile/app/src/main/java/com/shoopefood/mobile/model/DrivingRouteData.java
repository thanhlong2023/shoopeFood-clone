package com.shoopefood.mobile.model;

import java.util.ArrayList;
import java.util.List;

public class DrivingRouteData {
    public boolean ok;
    public List<RoutePoint> geometry;
    public double distanceKm;
    public double durationMinutes;
    public String error;

    public List<RoutePoint> safeGeometry() {
        return geometry != null ? geometry : new ArrayList<>();
    }
}
