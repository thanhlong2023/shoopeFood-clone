package com.shoopefood.mobile.location;

/**
 * LocationClient — interface định nghĩa contract cho việc lấy dữ liệu GPS.
 *
 * <p><b>Tại sao cần Interface?</b> (SOLID — Dependency Inversion Principle)
 * <ul>
 *   <li>Tầng Domain/Presentation không phụ thuộc trực tiếp vào FusedLocationProviderClient.</li>
 *   <li>Dễ thay thế implementation (mock cho testing, OSRM, native GPS...).</li>
 *   <li>Trong Kotlin/Flow: interface này tương đương việc expose một cold {@code Flow<Location>}.</li>
 * </ul>
 *
 * <p><b>Luồng dữ liệu:</b>
 * <pre>
 *   FusedLocationClient (impl) → LocationTrackingService → ViewModel → UI
 * </pre>
 *
 * <p>Trong project này, vì dùng Java (không phải Kotlin Coroutines),
 * callback pattern được dùng thay cho Flow — nhưng vẫn giữ contract tương tự.
 */
public interface LocationClient {

    /**
     * Bắt đầu nhận cập nhật vị trí liên tục.
     *
     * <p>Tương đương Kotlin: {@code fun getLocationUpdates(interval: Long): Flow<Location>}
     *
     * @param listener callback nhận dữ liệu vị trí hoặc lỗi
     */
    void startLocationUpdates(LocationUpdateListener listener);

    /**
     * Dừng nhận cập nhật vị trí và giải phóng tài nguyên.
     *
     * <p>⚠️ PHẢI gọi khi Service bị destroy để tránh memory leak.
     */
    void stopLocationUpdates();

    // ─── Callback Interface ───────────────────────────────────────────────────

    /**
     * Callback interface nhận dữ liệu vị trí realtime.
     *
     * <p>Equivalent với Kotlin: suspend fun hoặc Flow collector.
     */
    interface LocationUpdateListener {

        /**
         * Gọi khi nhận được cập nhật vị trí mới.
         *
         * @param latitude   vĩ độ (degrees)
         * @param longitude  kinh độ (degrees)
         * @param bearing    hướng di chuyển tính từ True North, tính bằng degrees (0–360).
         *                   Dùng để xoay icon tài xế trên bản đồ.
         * @param accuracy   độ chính xác tính bằng meters (nhỏ hơn = tốt hơn)
         * @param speedKmh   tốc độ di chuyển (km/h), 0 nếu thiết bị không hỗ trợ
         */
        void onLocationUpdate(
                double latitude,
                double longitude,
                float bearing,
                float accuracy,
                float speedKmh
        );

        /**
         * Gọi khi có lỗi xảy ra trong quá trình tracking.
         *
         * @param error lỗi có kiểu rõ ràng — GPS_DISABLED / PERMISSION_DENIED / PROVIDER_ERROR.
         *              Presentation layer dùng {@code error.getErrorType()} để xử lý từng case.
         */
        void onError(LocationException error);
    }
}
