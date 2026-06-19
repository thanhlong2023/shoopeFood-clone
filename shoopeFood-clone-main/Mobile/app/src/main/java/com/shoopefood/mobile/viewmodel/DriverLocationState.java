package com.shoopefood.mobile.viewmodel;

/**
 * DriverLocationState — UI State Model cho dữ liệu GPS của tài xế.
 *
 * <p>Đây là tầng Domain/Presentation boundary. ViewModel expose LiveData chứa object này,
 * và Activity/Fragment chỉ cần observe và render — không cần biết gì về FusedLocation.
 *
 * <p><b>Tại sao dùng immutable state object?</b> (Unidirectional Data Flow)
 * <ul>
 *   <li>State luôn nhất quán — không có partial update gây bug khó debug.</li>
 *   <li>Thread-safe — LiveData.setValue() đảm bảo update atomic trên Main Thread.</li>
 *   <li>Dễ test — chỉ cần assert state object thay vì mock nhiều method.</li>
 * </ul>
 *
 * <p>Kotlin tương đương:
 * <pre>
 *   data class DriverLocationState(
 *       val status: TrackingStatus = TrackingStatus.IDLE,
 *       val latitude: Double = 0.0,
 *       val longitude: Double = 0.0,
 *       val bearing: Float = 0f,
 *       val accuracy: Float = 0f,
 *       val speedKmh: Float = 0f,
 *       val errorMessage: String? = null
 *   )
 * </pre>
 */
public final class DriverLocationState {

    // ─── Tracking Status (Sealed Class Equivalent) ────────────────────────────

    /**
     * Trạng thái tracking — tương đương sealed class trong Kotlin.
     *
     * <p>Pattern matching trong Java: dùng switch/if trên enum này.
     */
    public enum TrackingStatus {
        /**
         * Service chưa được khởi động hoặc đã dừng.
         * UI: hiển thị trạng thái offline.
         */
        IDLE,

        /**
         * Đang tracking và nhận được dữ liệu GPS.
         * UI: hiển thị tọa độ, xoay icon theo bearing.
         */
        TRACKING,

        /**
         * GPS bị tắt trong Settings.
         * UI: hiển thị dialog hướng dẫn bật GPS.
         * Tương đương: LocationException.GpsDisabled trong Kotlin sealed class.
         */
        GPS_DISABLED,

        /**
         * Chưa được cấp quyền vị trí.
         * UI: hiển thị rationale dialog.
         * Tương đương: LocationException.PermissionDenied trong Kotlin sealed class.
         */
        PERMISSION_DENIED,

        /**
         * Lỗi runtime từ GPS provider.
         * UI: hiển thị error message, retry button.
         */
        ERROR
    }

    // ─── State Fields (Immutable) ─────────────────────────────────────────────

    /** Trạng thái tracking hiện tại */
    public final TrackingStatus status;

    /** Vĩ độ — valid khi status == TRACKING */
    public final double latitude;

    /** Kinh độ — valid khi status == TRACKING */
    public final double longitude;

    /**
     * Hướng di chuyển từ True North (0–360 degrees).
     * Dùng để xoay icon tài xế trên bản đồ theo hướng đang đi.
     * 0 = Bắc, 90 = Đông, 180 = Nam, 270 = Tây.
     */
    public final float bearing;

    /**
     * Độ chính xác tính bằng meters.
     * Nhỏ hơn = tốt hơn. < 20m = excellent, < 50m = good, > 100m = poor.
     */
    public final float accuracy;

    /** Tốc độ di chuyển tính bằng km/h */
    public final float speedKmh;

    /**
     * Message lỗi để hiển thị trên UI.
     * Chỉ có giá trị khi status == GPS_DISABLED / PERMISSION_DENIED / ERROR.
     */
    public final String errorMessage;

    // ─── Constructor ──────────────────────────────────────────────────────────

    private DriverLocationState(
            TrackingStatus status,
            double latitude,
            double longitude,
            float bearing,
            float accuracy,
            float speedKmh,
            String errorMessage
    ) {
        this.status = status;
        this.latitude = latitude;
        this.longitude = longitude;
        this.bearing = bearing;
        this.accuracy = accuracy;
        this.speedKmh = speedKmh;
        this.errorMessage = errorMessage;
    }

    // ─── Static Factory Methods ───────────────────────────────────────────────

    /** Trạng thái khởi đầu — chưa tracking */
    public static DriverLocationState idle() {
        return new DriverLocationState(TrackingStatus.IDLE, 0, 0, 0, 0, 0, null);
    }

    /** Đang tracking với dữ liệu GPS mới nhất */
    public static DriverLocationState tracking(
            double latitude,
            double longitude,
            float bearing,
            float accuracy,
            float speedKmh
    ) {
        return new DriverLocationState(
                TrackingStatus.TRACKING,
                latitude, longitude,
                bearing, accuracy, speedKmh,
                null
        );
    }

    /** GPS bị tắt trong Settings */
    public static DriverLocationState gpsDisabled() {
        return new DriverLocationState(
                TrackingStatus.GPS_DISABLED,
                0, 0, 0, 0, 0,
                "GPS đang tắt. Vui lòng bật Vị trí trong Cài đặt để tiếp tục."
        );
    }

    /** Chưa có quyền vị trí */
    public static DriverLocationState permissionDenied() {
        return new DriverLocationState(
                TrackingStatus.PERMISSION_DENIED,
                0, 0, 0, 0, 0,
                "Ứng dụng cần quyền truy cập vị trí để theo dõi hành trình."
        );
    }

    /** Lỗi provider runtime */
    public static DriverLocationState error(String message) {
        return new DriverLocationState(
                TrackingStatus.ERROR,
                0, 0, 0, 0, 0,
                message != null ? message : "Lỗi GPS không xác định."
        );
    }

    // ─── Convenience Checkers ────────────────────────────────────────────────

    public boolean isTracking() {
        return status == TrackingStatus.TRACKING;
    }

    public boolean hasValidCoordinates() {
        return isTracking() && latitude != 0 && longitude != 0;
    }

    @Override
    public String toString() {
        return "DriverLocationState{" +
                "status=" + status +
                ", lat=" + latitude +
                ", lng=" + longitude +
                ", bearing=" + bearing +
                ", accuracy=" + accuracy + "m" +
                ", speed=" + speedKmh + "km/h" +
                '}';
    }
}
