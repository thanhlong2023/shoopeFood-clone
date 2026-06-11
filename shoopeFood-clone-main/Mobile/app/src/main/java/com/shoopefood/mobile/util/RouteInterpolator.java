package com.shoopefood.mobile.util;

import com.shoopefood.mobile.model.RoutePoint;

import java.util.ArrayList;
import java.util.List;

public final class RouteInterpolator {

    private RouteInterpolator() {
    }

    public static RoutePoint pointAtFraction(List<RoutePoint> route, double fraction) {
        if (route == null || route.isEmpty()) {
            return new RoutePoint(0, 0);
        }
        if (route.size() == 1 || fraction <= 0) {
            return route.get(0);
        }
        if (fraction >= 1) {
            return route.get(route.size() - 1);
        }

        List<Double> cumulativeKm = buildCumulativeDistances(route);
        double totalKm = cumulativeKm.get(cumulativeKm.size() - 1);
        if (totalKm <= 0) {
            return route.get(0);
        }

        double targetKm = totalKm * fraction;
        for (int i = 1; i < route.size(); i++) {
            if (cumulativeKm.get(i) >= targetKm) {
                double segmentStart = cumulativeKm.get(i - 1);
                double segmentEnd = cumulativeKm.get(i);
                double segmentLength = segmentEnd - segmentStart;
                double segmentFraction = segmentLength <= 0
                        ? 0
                        : (targetKm - segmentStart) / segmentLength;

                RoutePoint from = route.get(i - 1);
                RoutePoint to = route.get(i);
                return new RoutePoint(
                        from.latitude + (to.latitude - from.latitude) * segmentFraction,
                        from.longitude + (to.longitude - from.longitude) * segmentFraction
                );
            }
        }
        return route.get(route.size() - 1);
    }

    private static List<Double> buildCumulativeDistances(List<RoutePoint> route) {
        List<Double> cumulative = new ArrayList<>();
        cumulative.add(0d);
        double sum = 0d;
        for (int i = 1; i < route.size(); i++) {
            RoutePoint prev = route.get(i - 1);
            RoutePoint current = route.get(i);
            sum += GeoUtils.distanceKm(prev.latitude, prev.longitude, current.latitude, current.longitude);
            cumulative.add(sum);
        }
        return cumulative;
    }
}
