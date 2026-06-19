package com.shoopefood.mobile.location;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.google.android.gms.common.api.ResolvableApiException;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationSettingsRequest;
import com.google.android.gms.location.Priority;
import com.google.android.gms.location.SettingsClient;
public class DriverLocationHelper {

    private static final long FETCH_TIMEOUT_MS = 25_000L;
    private static final long MAX_LOCATION_AGE_MS = 15_000L;
    private static final float PREFERRED_ACCURACY_METERS = 50f;
    private static final float MAX_ACCEPTABLE_ACCURACY_METERS = 200f;

    public interface OnLocationResult {
        void onSuccess(double latitude, double longitude, float accuracyMeters);

        void onError(String message);
    }

    public interface OnSettingsRequired {
        void onResolutionRequired(ResolvableApiException exception);
    }

    private final FusedLocationProviderClient fusedLocationClient;
    private final SettingsClient settingsClient;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private OnLocationResult fetchCallback;
    private OnLocationResult watchCallback;
    private LocationCallback fetchUpdatesCallback;
    private LocationCallback watchUpdatesCallback;
    private Location bestFetchLocation;
    private boolean fetchDelivered;

    public DriverLocationHelper(Context context) {
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(context);
        settingsClient = LocationServices.getSettingsClient(context);
    }

    public boolean hasLocationPermission(Context context) {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    public void ensureLocationEnabled(Context context, Runnable onReady, OnSettingsRequired onSettingsRequired, Runnable onUnavailable) {
        LocationRequest request = buildHighAccuracyRequest(3000L);
        LocationSettingsRequest settingsRequest = new LocationSettingsRequest.Builder()
                .addLocationRequest(request)
                .setAlwaysShow(true)
                .build();

        settingsClient.checkLocationSettings(settingsRequest)
                .addOnSuccessListener(unused -> onReady.run())
                .addOnFailureListener(error -> {
                    if (error instanceof ResolvableApiException) {
                        onSettingsRequired.onResolutionRequired((ResolvableApiException) error);
                    } else {
                        onUnavailable.run();
                    }
                });
    }

    public void fetchCurrentLocation(Context context, OnLocationResult callback) {
        if (!hasLocationPermission(context)) {
            callback.onError("Chưa cấp quyền vị trí");
            return;
        }

        try {
            LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000)
                    .setMaxUpdates(1)
                    .setDurationMillis(15000)
                    .build();

            LocationCallback singleUpdateCallback = new LocationCallback() {
                @Override
                public void onLocationResult(@NonNull LocationResult locationResult) {
                    Location location = locationResult.getLastLocation();
                    if (location != null) {
                        callback.onSuccess(location.getLatitude(), location.getLongitude(),
                                location.hasAccuracy() ? location.getAccuracy() : 0f);
                    } else {
                        callback.onError("Không thể lấy vị trí hiện tại.");
                    }
                }
            };

            fusedLocationClient.requestLocationUpdates(request, singleUpdateCallback, Looper.getMainLooper());
        } catch (SecurityException e) {
            callback.onError("Không có quyền truy cập vị trí");
        }
    }

    public void stopFetch() {
        // Not needed with getCurrentLocation
    }

    public void startWatching(OnLocationResult callback) {
        stopWatching();
        watchCallback = callback;
        watchUpdatesCallback = createUpdatesCallback(callback);
        try {
            fusedLocationClient.requestLocationUpdates(
                    buildHighAccuracyRequest(4000L),
                    watchUpdatesCallback,
                    Looper.getMainLooper()
            );
        } catch (SecurityException ex) {
            watchCallback = null;
            watchUpdatesCallback = null;
        }
    }

    public void stopWatching() {
        if (watchUpdatesCallback != null) {
            fusedLocationClient.removeLocationUpdates(watchUpdatesCallback);
            watchUpdatesCallback = null;
        }
        watchCallback = null;
    }

    private void startFetchUpdates() {
        fetchUpdatesCallback = createUpdatesCallback(new OnLocationResult() {
            @Override
            public void onSuccess(double latitude, double longitude, float accuracyMeters) {
                Location candidate = new Location("fused");
                candidate.setLatitude(latitude);
                candidate.setLongitude(longitude);
                candidate.setAccuracy(accuracyMeters);
                candidate.setTime(System.currentTimeMillis());

                if (bestFetchLocation == null || isBetterLocation(candidate, bestFetchLocation)) {
                    bestFetchLocation = candidate;
                }

                if (accuracyMeters <= PREFERRED_ACCURACY_METERS) {
                    deliverFetch(candidate);
                }
            }

            @Override
            public void onError(String message) {
                finishFetchWithError(message);
            }
        });

        try {
            fusedLocationClient.requestLocationUpdates(
                    buildHighAccuracyRequest(1000L),
                    fetchUpdatesCallback,
                    Looper.getMainLooper()
            );
        } catch (SecurityException ex) {
            finishFetchWithError("Không có quyền truy cập vị trí");
        }
    }

    private LocationCallback createUpdatesCallback(OnLocationResult callback) {
        return new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) {
                    return;
                }

                Location best = null;
                for (Location location : locationResult.getLocations()) {
                    if (!isUsableLocation(location)) {
                        continue;
                    }
                    if (best == null || isBetterLocation(location, best)) {
                        best = location;
                    }
                }

                if (best == null || callback == null) {
                    return;
                }

                callback.onSuccess(best.getLatitude(), best.getLongitude(), best.getAccuracy());
            }
        };
    }

    private void deliverFetch(Location location) {
        if (fetchDelivered || fetchCallback == null) {
            return;
        }
        fetchDelivered = true;
        mainHandler.removeCallbacksAndMessages(null);
        OnLocationResult callback = fetchCallback;
        stopFetchUpdatesOnly();
        fetchCallback = null;
        callback.onSuccess(location.getLatitude(), location.getLongitude(), location.getAccuracy());
    }

    private void finishFetchWithBestOrError() {
        if (fetchDelivered || fetchCallback == null) {
            return;
        }

        if (bestFetchLocation != null && bestFetchLocation.getAccuracy() <= MAX_ACCEPTABLE_ACCURACY_METERS) {
            deliverFetch(bestFetchLocation);
            return;
        }

        if (bestFetchLocation != null) {
            finishFetchWithError(String.format(
                    "GPS chưa đủ chính xác (sai số %.0fm). Đi ra nơi thoáng hơn rồi thử lại.",
                    bestFetchLocation.getAccuracy()
            ));
            return;
        }

        finishFetchWithError("Không lấy được vị trí GPS. Hãy bật định vị và thử lại.");
    }

    private void finishFetchWithError(String message) {
        if (fetchDelivered || fetchCallback == null) {
            return;
        }
        fetchDelivered = true;
        mainHandler.removeCallbacksAndMessages(null);
        OnLocationResult callback = fetchCallback;
        stopFetchUpdatesOnly();
        fetchCallback = null;
        callback.onError(message);
    }

    private void stopFetchUpdatesOnly() {
        if (fetchUpdatesCallback != null) {
            fusedLocationClient.removeLocationUpdates(fetchUpdatesCallback);
            fetchUpdatesCallback = null;
        }
        bestFetchLocation = null;
    }

    private LocationRequest buildHighAccuracyRequest(long intervalMs) {
        return new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
                .setWaitForAccurateLocation(true)
                .setMinUpdateIntervalMillis(Math.max(1000L, intervalMs / 2))
                .setMaxUpdateDelayMillis(intervalMs * 2)
                .build();
    }

    private boolean isUsableLocation(Location location) {
        if (location == null) {
            return false;
        }

        double lat = location.getLatitude();
        double lng = location.getLongitude();
        if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
            return false;
        }

        return true;
    }

    private boolean isBetterLocation(Location candidate, Location current) {
        if (!candidate.hasAccuracy()) {
            return current == null;
        }
        if (current == null || !current.hasAccuracy()) {
            return true;
        }
        if (candidate.getAccuracy() + 15f < current.getAccuracy()) {
            return true;
        }
        if (Math.abs(candidate.getAccuracy() - current.getAccuracy()) <= 15f) {
            return candidate.getTime() >= current.getTime();
        }
        return false;
    }

    private boolean isMockLocation(Location location) {
        // Allow mock locations for emulator testing and development
        return false;
    }
}
