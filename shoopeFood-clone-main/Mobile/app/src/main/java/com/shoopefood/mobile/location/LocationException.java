package com.shoopefood.mobile.location;

/**
 * LocationException — đại diện cho các lỗi có thể xảy ra trong quá trình tracking GPS.
 *
 * <p>Tương đương với Kotlin sealed class trong Java thuần:
 * <pre>
 *   sealed class LocationException {
 *       object GpsDisabled : LocationException()
 *       object PermissionDenied : LocationException()
 *       data class ProviderError(val cause: Throwable) : LocationException()
 *   }
 * </pre>
 *
 * <p>Design Pattern: Factory Method — dùng static factories thay vì constructor trực tiếp.
 * Lý do: đảm bảo type-safety và readability khi xử lý ở tầng Presentation.
 */
public final class LocationException extends Exception {

    /** Các loại lỗi có thể xảy ra với GPS tracking */
    public enum Type {
        /**
         * GPS bị tắt toàn hệ thống (Location Services = OFF trong Settings).
         * Action cần làm: Mở Settings để bật GPS.
         */
        GPS_DISABLED,

        /**
         * App chưa được cấp quyền ACCESS_FINE_LOCATION hoặc ACCESS_COARSE_LOCATION.
         * Action cần làm: Hiển thị rationale dialog và request permission.
         */
        PERMISSION_DENIED,

        /**
         * Provider GPS gặp lỗi runtime (FusedLocation unavailable, SecurityException...).
         * Action cần làm: Log lỗi và retry sau một khoảng thời gian.
         */
        PROVIDER_ERROR
    }

    private final Type errorType;

    private LocationException(Type type, String message) {
        super(message);
        this.errorType = type;
    }

    private LocationException(Type type, String message, Throwable cause) {
        super(message, cause);
        this.errorType = type;
    }

    // ─── Factory Methods ─────────────────────────────────────────────────────

    /**
     * GPS bị tắt trong Settings.
     * Tương đương: LocationException.GpsDisabled trong Kotlin sealed class.
     */
    public static LocationException gpsDisabled() {
        return new LocationException(
                Type.GPS_DISABLED,
                "GPS (Location Services) bị tắt. Vui lòng bật GPS trong Cài đặt."
        );
    }

    /**
     * Chưa có quyền truy cập vị trí.
     * Tương đương: LocationException.PermissionDenied trong Kotlin sealed class.
     */
    public static LocationException permissionDenied() {
        return new LocationException(
                Type.PERMISSION_DENIED,
                "Chưa được cấp quyền truy cập vị trí. Vui lòng cấp quyền trong Cài đặt."
        );
    }

    /**
     * Lỗi runtime từ GPS provider.
     * Tương đương: LocationException.ProviderError(cause) trong Kotlin sealed class.
     */
    public static LocationException providerError(Throwable cause) {
        return new LocationException(
                Type.PROVIDER_ERROR,
                "Không thể khởi động GPS: " + cause.getMessage(),
                cause
        );
    }

    /** Trả về loại lỗi để xử lý ở tầng Presentation (pattern matching thay cho when/switch) */
    public Type getErrorType() {
        return errorType;
    }

    /** Kiểm tra nhanh có phải GPS disabled không */
    public boolean isGpsDisabled() {
        return errorType == Type.GPS_DISABLED;
    }

    /** Kiểm tra nhanh có phải permission denied không */
    public boolean isPermissionDenied() {
        return errorType == Type.PERMISSION_DENIED;
    }
}
