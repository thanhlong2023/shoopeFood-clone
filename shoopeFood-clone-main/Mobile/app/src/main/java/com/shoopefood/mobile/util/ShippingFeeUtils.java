package com.shoopefood.mobile.util;

public final class ShippingFeeUtils {

    private static final double STANDARD_PER_KM_FEE = 3500;

    private ShippingFeeUtils() {
    }

    public static double estimateStandardFee(double distanceKm) {
        double validDistance = Double.isFinite(distanceKm) ? Math.max(0, distanceKm) : 0;
        return validDistance * STANDARD_PER_KM_FEE;
    }
}
