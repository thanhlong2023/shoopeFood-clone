package com.shoopefood.mobile.util;

public final class GeoUtils {

    private static final double EARTH_RADIUS_KM = 6371.0;

    private GeoUtils() {
    }

    public static double distanceKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }

    public static boolean isValidCoordinate(double latitude, double longitude) {
        return latitude >= -90 && latitude <= 90
                && longitude >= -180 && longitude <= 180
                && !(latitude == 0 && longitude == 0);
    }

    public static double[] offsetKm(double latitude, double longitude, double distanceKm, double bearingDegrees) {
        double angularDistance = distanceKm / EARTH_RADIUS_KM;
        double bearing = Math.toRadians(bearingDegrees);
        double latRad = Math.toRadians(latitude);
        double lngRad = Math.toRadians(longitude);

        double lat2 = Math.asin(
                Math.sin(latRad) * Math.cos(angularDistance)
                        + Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
        );
        double lng2 = lngRad + Math.atan2(
                Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
                Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(lat2)
        );

        return new double[]{Math.toDegrees(lat2), Math.toDegrees(lng2)};
    }
}
