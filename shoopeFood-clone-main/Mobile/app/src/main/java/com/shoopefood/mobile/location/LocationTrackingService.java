package com.shoopefood.mobile.location;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.shoopefood.mobile.R;
import com.shoopefood.mobile.ui.DriverHomeActivity;

/**
 * LocationTrackingService — Android Foreground Service đảm bảo GPS tracking liên tục.
 *
 * <p><b>Tại sao cần Foreground Service?</b>
 * Khi app bị minimize hoặc màn hình khóa, Android có thể kill process để tiết kiệm RAM.
 * Foreground Service + persistent notification = Android biết app đang làm việc quan trọng
 * và không kill process.
 *
 * <p><b>Lifecycle của Service:</b>
 * <pre>
 *   onCreate()            → tạo notification channel
 *   onStartCommand()      → gọi startForeground() + bắt đầu tracking
 *   [tracking running]    → nhận GPS updates liên tục, broadcast về Activity
 *   onDestroy()           → stopLocationUpdates() + cancel coroutineScope (cleanup bắt buộc!)
 * </pre>
 *
 * <p><b>Communication Pattern:</b> Service → Activity dùng {@link LocalBroadcastManager}.
 * Lý do: thread-safe, không cần AIDL, chỉ trong cùng process.
 *
 * <p><b>Binding Pattern:</b> Activity có thể bind vào Service để gọi start/stop trực tiếp.
 */
public class LocationTrackingService extends Service {

    // ─── Constants ────────────────────────────────────────────────────────────

    /** Notification Channel ID — phải duy nhất trong app */
    public static final String NOTIFICATION_CHANNEL_ID = "location_tracking";

    /** Notification ID — dùng để update notification realtime */
    private static final int NOTIFICATION_ID = 1001;

    /** Action để start tracking từ Activity */
    public static final String ACTION_START = "com.shoopefood.mobile.location.START";

    /** Action để stop tracking từ Activity */
    public static final String ACTION_STOP  = "com.shoopefood.mobile.location.STOP";

    /** Broadcast action — Activity lắng nghe event này */
    public static final String BROADCAST_LOCATION_UPDATE = "com.shoopefood.mobile.location.UPDATE";
    public static final String BROADCAST_LOCATION_ERROR  = "com.shoopefood.mobile.location.ERROR";

    /** Bundle keys cho Broadcast extras */
    public static final String EXTRA_LATITUDE   = "latitude";
    public static final String EXTRA_LONGITUDE  = "longitude";
    public static final String EXTRA_BEARING    = "bearing";
    public static final String EXTRA_ACCURACY   = "accuracy";
    public static final String EXTRA_SPEED_KMH  = "speed_kmh";
    public static final String EXTRA_ERROR_TYPE = "error_type";
    public static final String EXTRA_ERROR_MSG  = "error_message";

    // ─── Dependencies ─────────────────────────────────────────────────────────

    /** LocationClient — injected theo pattern Dependency Inversion */
    private LocationClient locationClient;

    private LocalBroadcastManager broadcastManager;
    private NotificationManager notificationManager;

    /** Binder cho Activity binding */
    private final IBinder binder = new LocationServiceBinder();

    /** Tracking state */
    private boolean isTracking = false;

    // ─── Binder Class ────────────────────────────────────────────────────────

    /**
     * Binder cho phép Activity gọi method trực tiếp vào Service.
     * Pattern: Bound Service — dùng khi Activity cần gọi API của Service.
     */
    public class LocationServiceBinder extends Binder {
        public LocationTrackingService getService() {
            return LocationTrackingService.this;
        }
    }

    // ─── Service Lifecycle ────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        // Khởi tạo dependencies — không inject qua constructor vì Service có no-arg constructor
        locationClient    = new FusedLocationClient(this);
        broadcastManager  = LocalBroadcastManager.getInstance(this);
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;

        if (ACTION_STOP.equals(action)) {
            stopTracking();
            stopSelf();
            return START_NOT_STICKY;
        }

        // Default: ACTION_START
        if (!isTracking) {
            // startForeground() PHẢI được gọi trong 5 giây sau onStartCommand()
            // nếu không Android sẽ throw ANR exception
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, buildNotification("Đang khởi động GPS..."), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, buildNotification("Đang khởi động GPS..."));
            }
            startTracking();
        }

        // START_STICKY: Android sẽ tự restart service nếu bị kill (với intent == null)
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    /**
     * ⚠️ CRITICAL: onDestroy() PHẢI cleanup để tránh memory leak!
     *
     * <p>Kotlin tương đương: cancel coroutineScope + remove flow collector.
     * Java tương đương: removeLocationUpdates() + clear callbacks.
     */
    @Override
    public void onDestroy() {
        stopTracking(); // Giải phóng FusedLocation callback
        super.onDestroy();
    }

    // ─── Tracking Logic ───────────────────────────────────────────────────────

    private void startTracking() {
        isTracking = true;

        locationClient.startLocationUpdates(new LocationClient.LocationUpdateListener() {

            @Override
            public void onLocationUpdate(
                    double latitude,
                    double longitude,
                    float bearing,
                    float accuracy,
                    float speedKmh
            ) {
                // Cập nhật notification với tọa độ realtime
                String statusText = String.format(
                        java.util.Locale.US,
                        "%.5f, %.5f | %.0f km/h",
                        latitude, longitude, speedKmh
                );
                updateNotification(statusText);

                // Broadcast về Activity/ViewModel để update UI
                broadcastLocationUpdate(latitude, longitude, bearing, accuracy, speedKmh);
            }

            @Override
            public void onError(LocationException error) {
                // Cập nhật notification hiển thị lỗi
                String errorText = error.getMessage() != null
                        ? error.getMessage()
                        : "GPS không khả dụng";
                updateNotification("⚠️ " + errorText);

                // Broadcast lỗi về Activity để xử lý UI (show dialog, etc.)
                broadcastLocationError(error);

                // Nếu GPS tắt hoặc không có permission → stop service
                if (error.isGpsDisabled() || error.isPermissionDenied()) {
                    isTracking = false;
                    stopSelf();
                }
            }
        });
    }

    /** Dừng tracking và giải phóng tài nguyên */
    public void stopTracking() {
        isTracking = false;
        if (locationClient != null) {
            locationClient.stopLocationUpdates(); // ← Bắt buộc! Không có dòng này = memory leak
        }
    }

    // ─── Notification Management ──────────────────────────────────────────────

    /**
     * Tạo Notification Channel — bắt buộc trên Android 8.0+ (API 26+).
     *
     * <p>Channel chỉ được tạo một lần. Gọi lại sẽ bị ignore nếu channel đã tồn tại.
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    NOTIFICATION_CHANNEL_ID,
                    "GPS Tracking",                           // Tên hiển thị trong Settings
                    NotificationManager.IMPORTANCE_LOW        // LOW = không phát âm thanh
            );
            channel.setDescription("Theo dõi vị trí tài xế trong khi giao hàng");
            channel.setShowBadge(false);                      // Không hiển thị badge trên icon app
            notificationManager.createNotificationChannel(channel);
        }
    }

    /** Xây dựng notification với nội dung tùy chỉnh */
    private Notification buildNotification(String contentText) {
        // Intent mở lại DriverHomeActivity khi user tap notification
        Intent openIntent = new Intent(this, DriverHomeActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_app_logo)
                .setContentTitle("ShoopeFood Driver — GPS đang hoạt động")
                .setContentText(contentText)
                .setContentIntent(pendingIntent)
                .setOngoing(true)          // Không thể swipe dismiss
                .setOnlyAlertOnce(true)    // Không phát âm khi update
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .build();
    }

    /** Cập nhật nội dung notification không làm gián đoạn user */
    private void updateNotification(String contentText) {
        notificationManager.notify(NOTIFICATION_ID, buildNotification(contentText));
    }

    // ─── Local Broadcast Helpers ──────────────────────────────────────────────

    private void broadcastLocationUpdate(
            double latitude, double longitude, float bearing, float accuracy, float speedKmh
    ) {
        Intent intent = new Intent(BROADCAST_LOCATION_UPDATE);
        intent.putExtra(EXTRA_LATITUDE,  latitude);
        intent.putExtra(EXTRA_LONGITUDE, longitude);
        intent.putExtra(EXTRA_BEARING,   bearing);
        intent.putExtra(EXTRA_ACCURACY,  accuracy);
        intent.putExtra(EXTRA_SPEED_KMH, speedKmh);
        broadcastManager.sendBroadcast(intent);
    }

    private void broadcastLocationError(LocationException error) {
        Intent intent = new Intent(BROADCAST_LOCATION_ERROR);
        intent.putExtra(EXTRA_ERROR_TYPE, error.getErrorType().name());
        intent.putExtra(EXTRA_ERROR_MSG,  error.getMessage());
        broadcastManager.sendBroadcast(intent);
    }

    // ─── Public API (for Bound Service) ──────────────────────────────────────

    public boolean isTracking() {
        return isTracking;
    }
}
