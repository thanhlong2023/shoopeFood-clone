package com.shoopefood.mobile.util;

import com.shoopefood.mobile.model.RoutePoint;

import java.util.ArrayList;
import java.util.List;

public final class GeoRouteUtils {

    private static final int STRAIGHT_LINE_STEPS = 24;

    private GeoRouteUtils() {
    }

    public static List<RoutePoint> buildStraightLine(
            double fromLat,
            double fromLng,
            double toLat,
            double toLng
    ) {
        List<RoutePoint> points = new ArrayList<>();
        for (int step = 0; step <= STRAIGHT_LINE_STEPS; step++) {
            double fraction = step / (double) STRAIGHT_LINE_STEPS;
            points.add(new RoutePoint(
                    fromLat + (toLat - fromLat) * fraction,
                    fromLng + (toLng - fromLng) * fraction
            ));
        }
        return points;
    }
}
