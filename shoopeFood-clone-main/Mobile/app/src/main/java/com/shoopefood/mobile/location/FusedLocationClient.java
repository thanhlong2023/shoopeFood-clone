package com.shoopefood.mobile.location;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Looper;

import androidx.core.content.ContextCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

/**
 * FusedLocationClient — implementation của {@link LocationClient} dùng Google Play Services
 * {@link FusedLocationProviderClient}.
 *
 * <p><b>Tại sao dùng FusedLocationProviderClient thay vì GPS trực tiếp?</b>
 * <ul>
 *   <li>Tự động chọn provider tốt nhất (GPS + Network + Sensors) để tiết kiệm pin.</li>
 *   <li>Tích hợp sensor fusion của Google để tăng độ chính xác.</li>
 *   <li>Xử lý tự động các edge case (GPS warm-up, location unavailable...).</li>
 * </ul>
 *
 * <p><b>Cấu hình tracking:</b>
 * <ul>
 *   <li>Interval: 5000ms — cập nhật mỗi 5 giây (production trade-off: accuracy vs battery)</li>
 *   <li>Fastest Interval: 2000ms — tối thiểu 2 giây nếu có nhiều app cùng request</li>
 *   <li>Priority: PRIORITY_HIGH_ACCURACY — dùng GPS + network để có độ chính xác cao nhất</li>
 * </ul>
 *
 * <p><b>Edge cases được xử lý:</b>
 * <ul>
 *   <li>GPS disabled → emit {@code LocationException.gpsDisabled()}</li>
 *   <li>Permission denied → emit {@code LocationException.permissionDenied()}</li>
 *   <li>FusedLocation unavailable → emit {@code LocationException.providerError()}</li>
 *   <li>Emulator/Mock → chấp nhận mọi location (không filter mock)</li>
 * </ul>
 */
public class FusedLocationClient implements LocationClient {

    // ─── Tracking Configuration ───────────────────────────────────────────────
    private static final long UPDATE_INTERVAL_MS       = 5_000L;  // 5 seconds
    private static final long FASTEST_INTERVAL_MS      = 2_000L;  // 2 seconds
    private static final long MAX_UPDATE_DELAY_MS      = 10_000L; // 10 seconds max delay
    private static final float MIN_DISPLACEMENT_METERS = 5.0f;    // chỉ update nếu dịch chuyển >= 5m

    private final Context context;
    private final FusedLocationProviderClient fusedClient;

    /** Giữ reference để có thể remove callback đúng lúc — tránh memory leak */
    private LocationCallback activeCallback;

    public FusedLocationClient(Context context) {
        this.context = context.getApplicationContext(); // ApplicationContext tránh leak Activity
        this.fusedClient = LocationServices.getFusedLocationProviderClient(this.context);
    }

    // ─── LocationClient Implementation ────────────────────────────────────────

    @Override
    public void startLocationUpdates(LocationUpdateListener listener) {
        // [Edge Case 1] Kiểm tra permission trước khi bắt đầu
        if (!hasLocationPermission()) {
            listener.onError(LocationException.permissionDenied());
            return;
        }

        // [Edge Case 2] Kiểm tra GPS có được bật không
        if (!isGpsEnabled()) {
            listener.onError(LocationException.gpsDisabled());
            return;
        }

        // Đảm bảo không có callback cũ còn tồn tại (tránh double-register)
        stopLocationUpdates();

        // Xây dựng LocationRequest với high accuracy parameters
        LocationRequest locationRequest = new LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY,
                UPDATE_INTERVAL_MS
        )
                .setMinUpdateIntervalMillis(FASTEST_INTERVAL_MS)
                .setMaxUpdateDelayMillis(MAX_UPDATE_DELAY_MS)
                .setMinUpdateDistanceMeters(MIN_DISPLACEMENT_METERS)
                .setWaitForAccurateLocation(false) // Không chờ — trả về ngay location đầu tiên
                .build();

        // Tạo callback xử lý updates
        activeCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                if (result == null) return;

                // Lấy location mới nhất (FusedLocation có thể batch nhiều updates)
                Location location = result.getLastLocation();
                if (location == null) return;

                // Trích xuất bearing (hướng) và speed để hiển thị icon xoay trên map
                float bearing = location.hasBearing() ? location.getBearing() : 0f;
                float accuracy = location.hasAccuracy() ? location.getAccuracy() : 0f;
                float speedMs = location.hasSpeed() ? location.getSpeed() : 0f;
                float speedKmh = speedMs * 3.6f; // m/s → km/h

                listener.onLocationUpdate(
                        location.getLatitude(),
                        location.getLongitude(),
                        bearing,
                        accuracy,
                        speedKmh
                );
            }
        };

        // Đăng ký nhận updates — dùng MainLooper để callback trên Main Thread
        try {
            fusedClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null).addOnSuccessListener(location -> {
                if (location != null && listener != null) {
                    float bearing = location.hasBearing() ? location.getBearing() : 0f;
                    float accuracy = location.hasAccuracy() ? location.getAccuracy() : 0f;
                    float speedKmh = location.hasSpeed() ? location.getSpeed() * 3.6f : 0f;
                    listener.onLocationUpdate(location.getLatitude(), location.getLongitude(), bearing, accuracy, speedKmh);
                }
            });

            fusedClient.requestLocationUpdates(
                    locationRequest,
                    activeCallback,
                    Looper.getMainLooper()
            );
        } catch (SecurityException e) {
            // [Edge Case 3] SecurityException xảy ra nếu permission bị thu hồi runtime
            activeCallback = null;
            listener.onError(LocationException.permissionDenied());
        } catch (Exception e) {
            // [Edge Case 4] Lỗi runtime khác (FusedLocation service unavailable)
            activeCallback = null;
            listener.onError(LocationException.providerError(e));
        }
    }

    @Override
    public void stopLocationUpdates() {
        if (activeCallback != null) {
            fusedClient.removeLocationUpdates(activeCallback);
            activeCallback = null;
        }
    }

    // ─── Private Helpers ──────────────────────────────────────────────────────

    /**
     * Kiểm tra permission ACCESS_FINE_LOCATION.
     *
     * <p>ACCESS_FINE_LOCATION là bắt buộc cho PRIORITY_HIGH_ACCURACY.
     * Nếu chỉ có COARSE_LOCATION, FusedLocation vẫn chạy nhưng kém chính xác hơn.
     */
    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Kiểm tra GPS có được bật trong Settings không.
     *
     * <p>Khác với permission: GPS có thể bị tắt bởi user trong Settings dù app đã có quyền.
     * Trên API 28+, chỉ cần một provider nào đó (GPS hoặc Network) được bật là đủ.
     */
    private boolean isGpsEnabled() {
        LocationManager locationManager =
                (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) return false;

        // Kiểm tra cả GPS provider và Network provider
        boolean gpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
        boolean networkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);

        return gpsEnabled || networkEnabled;
    }
}
