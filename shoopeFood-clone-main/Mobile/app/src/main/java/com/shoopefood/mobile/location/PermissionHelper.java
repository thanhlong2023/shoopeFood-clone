package com.shoopefood.mobile.location;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.activity.result.ActivityResultLauncher;
import androidx.appcompat.app.AlertDialog;
import androidx.core.content.ContextCompat;
import android.content.Intent;

import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import java.util.ArrayList;
import java.util.List;

/**
 * PermissionHelper — utility xử lý toàn bộ permission flow cho GPS tracking.
 *
 * <p><b>Tại sao tách ra class riêng?</b> (Single Responsibility Principle)
 * Activity đã đủ phức tạp với UI logic. Permission logic riêng biệt để:
 * <ul>
 *   <li>Dễ test độc lập</li>
 *   <li>Tái sử dụng ở nhiều nơi</li>
 *   <li>Activity không bị "permission soup"</li>
 * </ul>
 *
 * <p><b>Permission flow theo API level:</b>
 * <pre>
 *   API 23+: ACCESS_FINE_LOCATION (runtime permission)
 *   API 33+: POST_NOTIFICATIONS (runtime permission)
 *   API 34+: FOREGROUND_SERVICE_LOCATION (chỉ cần khai báo trong Manifest, không runtime)
 * </pre>
 *
 * <p><b>Kotlin tương đương:</b>
 * <pre>
 *   // Accompanist Permissions
 *   val locationPermission = rememberPermissionState(ACCESS_FINE_LOCATION)
 *   LaunchedEffect(Unit) { locationPermission.launchPermissionRequest() }
 * </pre>
 */
public final class PermissionHelper {

    private PermissionHelper() {
        // Utility class — không instantiate
    }

    // ─── Permission Checkers ──────────────────────────────────────────────────

    /**
     * Kiểm tra app có đủ permission để tracking GPS không.
     * ACCESS_FINE_LOCATION là permission chính, bắt buộc.
     */
    public static boolean hasLocationPermission(Context context) {
        return ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Kiểm tra permission thông báo (API 33+).
     * Trên API < 33, luôn trả về true vì không cần runtime permission.
     */
    public static boolean hasNotificationPermission(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return true; // API < 33: không cần runtime permission
        }
        return ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Lấy danh sách tất cả permissions cần request cho GPS tracking service.
     *
     * <p>Chỉ bao gồm những permissions chưa được cấp.
     *
     * @return mảng permissions cần request — empty nếu đã có đủ
     */
    public static String[] getMissingPermissions(Context context) {
        List<String> missing = new ArrayList<>();

        if (!hasLocationPermission(context)) {
            missing.add(Manifest.permission.ACCESS_FINE_LOCATION);
            missing.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }

        if (!hasNotificationPermission(context)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                missing.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        return missing.toArray(new String[0]);
    }

    /**
     * Kiểm tra có đủ tất cả permission cần thiết không.
     */
    public static boolean hasAllPermissions(Context context) {
        return hasLocationPermission(context) && hasNotificationPermission(context);
    }

    // ─── Permission Request Flow ──────────────────────────────────────────────

    /**
     * Yêu cầu permission với rationale dialog nếu user đã từ chối lần trước.
     *
     * <p><b>Flow:</b>
     * <pre>
     *   Có đủ permission? → callback onGranted()
     *         ↓ Không
     *   Cần show rationale? → Hiển thị MaterialAlertDialog giải thích lý do
     *         ↓ User đồng ý
     *   Gọi launcher.launch() để mở Permission Dialog của OS
     *         ↓ Kết quả về onRequestPermissionsResult / ActivityResultCallback
     * </pre>
     *
     * @param activity   Activity context để show dialog
     * @param launcher   ActivityResultLauncher đã đăng ký trong Activity
     * @param onGranted  callback khi đã có đủ permission
     */
    public static void requestLocationPermissions(
            Activity activity,
            ActivityResultLauncher<String[]> launcher,
            Runnable onGranted
    ) {
        if (hasAllPermissions(activity)) {
            onGranted.run();
            return;
        }

        // Kiểm tra có cần show rationale không
        // shouldShowRequestPermissionRationale = true nếu user đã từ chối ít nhất 1 lần
        boolean needRationale = activity.shouldShowRequestPermissionRationale(
                Manifest.permission.ACCESS_FINE_LOCATION
        );

        if (needRationale) {
            // User đã từ chối lần trước → giải thích lý do trước khi hỏi lại
            showRationaleDialog(activity, () -> launcher.launch(getMissingPermissions(activity)));
        } else {
            // Lần đầu request hoặc user chọn "Don't ask again" → request thẳng
            launcher.launch(getMissingPermissions(activity));
        }
    }

    // ─── Dialogs ──────────────────────────────────────────────────────────────

    /**
     * Hiển thị rationale dialog giải thích tại sao app cần quyền vị trí.
     *
     * <p>Best practice: giải thích rõ ràng lợi ích, không phán xét user.
     */
    public static void showRationaleDialog(Activity activity, Runnable onProceed) {
        new MaterialAlertDialogBuilder(activity)
                .setTitle("Cần quyền truy cập vị trí")
                .setMessage(
                        "ShoopeFood Driver cần quyền vị trí để:\n\n" +
                        "• Theo dõi hành trình giao hàng của bạn\n" +
                        "• Hiển thị vị trí cho khách hàng và nhà hàng\n" +
                        "• Tính toán lộ trình tối ưu\n\n" +
                        "Quyền này chỉ được sử dụng khi bạn đang nhận đơn."
                )
                .setIcon(android.R.drawable.ic_dialog_map)
                .setPositiveButton("Cấp quyền", (dialog, which) -> {
                    dialog.dismiss();
                    onProceed.run();
                })
                .setNegativeButton("Để sau", (dialog, which) -> dialog.dismiss())
                .setCancelable(false) // User phải chọn một trong hai
                .show();
    }

    /**
     * Hiển thị dialog hướng dẫn khi user chọn "Don't ask again".
     * Lúc này không thể request runtime nữa — phải hướng dẫn vào Settings.
     */
    public static void showGoToSettingsDialog(Activity activity) {
        new MaterialAlertDialogBuilder(activity)
                .setTitle("Quyền vị trí bị từ chối")
                .setMessage(
                        "Bạn đã từ chối quyền vị trí vĩnh viễn.\n\n" +
                        "Để tiếp tục nhận đơn, hãy vào:\n" +
                        "Cài đặt → Ứng dụng → ShoopeFood → Quyền → Vị trí → Cho phép"
                )
                .setPositiveButton("Mở Cài đặt", (dialog, which) -> {
                    dialog.dismiss();
                    openAppSettings(activity);
                })
                .setNegativeButton("Hủy", (dialog, which) -> dialog.dismiss())
                .show();
    }

    /**
     * Hiển thị dialog khi GPS bị tắt trong Settings.
     */
    public static void showGpsDisabledDialog(Activity activity, Runnable onOpenSettings) {
        new MaterialAlertDialogBuilder(activity)
                .setTitle("GPS đang tắt")
                .setMessage(
                        "Ứng dụng cần GPS để theo dõi hành trình của bạn.\n\n" +
                        "Vui lòng bật Vị trí trong Cài đặt để tiếp tục."
                )
                .setIcon(android.R.drawable.ic_dialog_alert)
                .setPositiveButton("Mở Cài đặt Vị trí", (dialog, which) -> {
                    dialog.dismiss();
                    onOpenSettings.run();
                })
                .setNegativeButton("Để sau", (dialog, which) -> dialog.dismiss())
                .show();
    }

    // ─── Private Helpers ──────────────────────────────────────────────────────

    private static void openAppSettings(Activity activity) {
        Intent intent = new android.content.Intent(
                android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS
        );
        intent.setData(android.net.Uri.fromParts("package", activity.getPackageName(), null));
        activity.startActivity(intent);
    }
}
