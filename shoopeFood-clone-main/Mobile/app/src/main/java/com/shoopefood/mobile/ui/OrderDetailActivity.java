package com.shoopefood.mobile.ui;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.button.MaterialButton;
import com.shoopefood.mobile.R;
import com.shoopefood.mobile.map.CustomerTrackingMapController;
import com.shoopefood.mobile.model.Driver;
import com.shoopefood.mobile.model.DriverCompletedDelivery;
import com.shoopefood.mobile.model.DriverProfileData;
import com.shoopefood.mobile.model.DriverProfileResponse;
import com.shoopefood.mobile.model.DriverSummary;
import com.shoopefood.mobile.model.Order;
import com.shoopefood.mobile.model.OrderResponse;
import com.shoopefood.mobile.model.OrderTracking;
import com.shoopefood.mobile.model.OrderTrackingResponse;
import com.shoopefood.mobile.model.RoutePoint;
import com.shoopefood.mobile.model.TrackingDriverLocation;
import com.shoopefood.mobile.model.TrackingRouteLeg;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;
import com.shoopefood.mobile.util.CurrencyUtils;
import com.shoopefood.mobile.util.CustomerTrackingRouteUtils;

import org.osmdroid.views.MapView;

import java.util.List;
import java.util.Locale;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class OrderDetailActivity extends AppCompatActivity {

    public static final String EXTRA_ORDER_ID = "order_id";
    private static final long POLL_INTERVAL_MS = 2000L;

    private ApiService apiService;
    private CustomerTrackingMapController mapController;
    private ProgressBar progressBar;
    private TextView codeText;
    private TextView statusText;
    private TextView addressText;
    private TextView totalText;
    private TextView itemsText;
    private TextView trackingText;
    private View driverProfileSection;
    private TextView driverProfileSummaryText;
    private TextView driverVehicleInfoText;
    private TextView driverDeliveriesText;
    private MapView mapView;
    private SwipeRefreshLayout swipeRefreshLayout;
    private MaterialButton cancelOrderButton;

    private final Handler pollHandler = new Handler(Looper.getMainLooper());
    private int manualRefreshTasks;
    private int loadedDriverProfileId = -1;
    private boolean driverAssignedDialogShown;
    private boolean driverDeliveringDialogShown;
    private boolean deliveryCompletedDialogShown;
    private int orderId;

    private final Runnable pollRunnable = new Runnable() {
        @Override
        public void run() {
            pollOrderStatus();
            pollTracking();
            pollHandler.postDelayed(this, POLL_INTERVAL_MS);
        }
    };

    // Simulation state
    private Double simulatedDriverLat;
    private Double simulatedDriverLng;
    private OrderTracking latestTracking;
    private List<RoutePoint> activePolyline = null;
    private int simPolylineIndex = 0;
    private String simStateKey = "";
    private static final double SIM_STEP_KM = 0.2;   // 0.2km mỗi 2s = 1km mỗi 10s
    private static final long SIM_INTERVAL_MS = 2000; // 2 giây

    private double distanceKm(double lat1, double lon1, double lat2, double lon2) {
        double p = 0.017453292519943295;
        double a = 0.5 - Math.cos((lat2 - lat1) * p) / 2 +
                Math.cos(lat1 * p) * Math.cos(lat2 * p) *
                        (1 - Math.cos((lon2 - lon1) * p)) / 2;
        return 12742 * Math.asin(Math.sqrt(a));
    }

    /**
     * Lấy geometry của leg phù hợp với trạng thái đơn hiện tại
     */
    private List<RoutePoint> resolveActivePolyline(OrderTracking tracking) {
        if (tracking == null || tracking.route == null || tracking.route.legs == null) return null;
        String statusCode = tracking.order != null ? tracking.order.statusCode : "";
        boolean isToMerchant = "DRIVER_ACCEPTED".equals(statusCode)
                || "PICKING_UP".equals(statusCode)
                || "CONFIRMED".equals(statusCode);
        boolean isToCustomer = "SHIPPING".equals(statusCode)
                || "DELIVERING".equals(statusCode);

        String legKey = isToMerchant ? "driver_to_restaurant" : (isToCustomer ? "restaurant_to_customer" : null);
        if (legKey == null) return null;

        for (TrackingRouteLeg leg : tracking.route.legs) {
            if (legKey.equals(leg.key) && leg.geometry != null && !leg.geometry.isEmpty()) {
                return leg.geometry;
            }
        }
        return null;
    }

    /**
     * Tiến dọc polyline thêm distKm km từ vị trí hiện tại, trả về điểm mới.
     * Cập nhật simPolylineIndex theo từng bước.
     */
    private RoutePoint advanceAlongPolyline(double distKm) {
        if (activePolyline == null || activePolyline.isEmpty()) return null;
        double distLeft = distKm;
        double curLat = simulatedDriverLat;
        double curLng = simulatedDriverLng;

        while (distLeft > 0 && simPolylineIndex < activePolyline.size() - 1) {
            RoutePoint next = activePolyline.get(simPolylineIndex + 1);
            double segDist = distanceKm(curLat, curLng, next.latitude, next.longitude);
            if (segDist < 0.0001) {
                simPolylineIndex++;
                continue;
            }
            if (distLeft >= segDist) {
                distLeft -= segDist;
                curLat = next.latitude;
                curLng = next.longitude;
                simPolylineIndex++;
            } else {
                double frac = distLeft / segDist;
                curLat = curLat + (next.latitude - curLat) * frac;
                curLng = curLng + (next.longitude - curLng) * frac;
                distLeft = 0;
            }
        }
        RoutePoint result = new RoutePoint(curLat, curLng);
        return result;
    }

    private final Runnable simulationRunnable = new Runnable() {
        @Override
        public void run() {
            if (latestTracking == null || latestTracking.order == null) {
                pollHandler.postDelayed(this, SIM_INTERVAL_MS);
                return;
            }

            String statusCode = latestTracking.order.statusCode;
            String newStateKey = (latestTracking.order.id) + "-" + statusCode;

            // Khi trạng thái thay đổi, lấy polyline mới và reset về đầu
            if (!newStateKey.equals(simStateKey)) {
                simStateKey = newStateKey;
                activePolyline = resolveActivePolyline(latestTracking);
                simPolylineIndex = 0;
                // Đặt vị trí bắt đầu = điểm đầu polyline
                if (activePolyline != null && !activePolyline.isEmpty()) {
                    RoutePoint startPt = activePolyline.get(0);
                    if (simulatedDriverLat == null) {
                        simulatedDriverLat = startPt.latitude;
                        simulatedDriverLng = startPt.longitude;
                    }
                }
            }

            if (activePolyline == null || activePolyline.isEmpty()
                    || simulatedDriverLat == null || simulatedDriverLng == null) {
                pollHandler.postDelayed(this, SIM_INTERVAL_MS);
                return;
            }

            // Đã đến cuối polyline
            if (simPolylineIndex >= activePolyline.size() - 1) {
                updateMapWithSimulatedLocation();
                pollHandler.postDelayed(this, SIM_INTERVAL_MS);
                return;
            }

            // Tiến thêm SIM_STEP_KM dọc polyline
            RoutePoint newPt = advanceAlongPolyline(SIM_STEP_KM);
            if (newPt != null) {
                simulatedDriverLat = newPt.latitude;
                simulatedDriverLng = newPt.longitude;
            }

            updateMapWithSimulatedLocation();
            pollHandler.postDelayed(this, SIM_INTERVAL_MS);
        }
    };

    private void updateMapWithSimulatedLocation() {
        if (mapController == null || latestTracking == null) return;
        List<TrackingRouteLeg> legs = CustomerTrackingRouteUtils.resolveLegs(latestTracking);
        String driverName = latestTracking.driver != null ? latestTracking.driver.fullName : null;
        String restaurantName = latestTracking.restaurant != null ? latestTracking.restaurant.name : "N/A";
        double restaurantLat = latestTracking.restaurant != null ? latestTracking.restaurant.latitude : 0;
        double restaurantLng = latestTracking.restaurant != null ? latestTracking.restaurant.longitude : 0;
        Double customerLat = latestTracking.destination != null ? Double.valueOf(latestTracking.destination.latitude) : null;
        Double customerLng = latestTracking.destination != null ? Double.valueOf(latestTracking.destination.longitude) : null;

        mapController.showTracking(new CustomerTrackingMapController.TrackingSnapshot(
                simulatedDriverLat, simulatedDriverLng, driverName, restaurantName,
                restaurantLat, restaurantLng, customerLat, customerLng, legs
        ));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_detail);

        apiService = ApiClient.getService(this);
        orderId = getIntent().getIntExtra(EXTRA_ORDER_ID, -1);

        if (orderId <= 0) {
            finish();
            return;
        }

        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setTitle(R.string.order_detail_title);
        }

        progressBar = findViewById(R.id.progressOrderDetail);
        codeText = findViewById(R.id.textOrderCode);
        statusText = findViewById(R.id.textOrderStatus);
        addressText = findViewById(R.id.textOrderAddress);
        totalText = findViewById(R.id.textOrderTotal);
        itemsText = findViewById(R.id.textOrderItems);
        trackingText = findViewById(R.id.textOrderTracking);
        driverProfileSection = findViewById(R.id.driverProfileSection);
        driverProfileSummaryText = findViewById(R.id.textDriverProfileSummary);
        driverVehicleInfoText = findViewById(R.id.textDriverVehicleInfo);
        driverDeliveriesText = findViewById(R.id.textDriverDeliveries);
        mapView = findViewById(R.id.mapOrderTracking);
        mapController = new CustomerTrackingMapController(mapView);
        swipeRefreshLayout = findViewById(R.id.swipeRefreshOrderDetail);
        swipeRefreshLayout.setColorSchemeResources(R.color.brand_green);
        swipeRefreshLayout.setOnRefreshListener(this::refreshContent);

        cancelOrderButton = findViewById(R.id.buttonCancelOrder);
        cancelOrderButton.setOnClickListener(v -> confirmCancelOrder());

        refreshContent();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mapController != null) {
            mapController.onResume();
        }
        pollHandler.post(pollRunnable);
        // pollHandler.post(simulationRunnable);
    }

    @Override
    protected void onPause() {
        pollHandler.removeCallbacks(pollRunnable);
        // pollHandler.removeCallbacks(simulationRunnable);
        if (mapController != null) {
            mapController.onPause();
        }
        super.onPause();
    }

    @Override
    public boolean onSupportNavigateUp() {
        finish();
        return true;
    }

    private void refreshContent() {
        manualRefreshTasks = 2;
        if (swipeRefreshLayout != null) {
            swipeRefreshLayout.setRefreshing(true);
        } else {
            progressBar.setVisibility(View.VISIBLE);
        }
        loadOrder();
        loadTracking(false);
    }

    private void completeManualRefresh() {
        if (manualRefreshTasks <= 0) {
            return;
        }
        manualRefreshTasks--;
        if (manualRefreshTasks == 0) {
            if (swipeRefreshLayout != null) {
                swipeRefreshLayout.setRefreshing(false);
            }
            progressBar.setVisibility(View.GONE);
        }
    }

    private void loadOrder() {
        if (manualRefreshTasks == 0 && swipeRefreshLayout != null && !swipeRefreshLayout.isRefreshing()) {
            progressBar.setVisibility(View.VISIBLE);
        }

        apiService.getOrderById(orderId).enqueue(new Callback<OrderResponse>() {
            @Override
            public void onResponse(Call<OrderResponse> call, Response<OrderResponse> response) {
                completeManualRefresh();

                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    Toast.makeText(OrderDetailActivity.this, ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                    return;
                }

                bindOrder(response.body().data);
                maybeShowDriverAssignedDialog(response.body().data);
                maybeShowDriverDeliveringDialog(response.body().data);
                maybeShowDeliveryCompletedDialog(response.body().data);
            }

            @Override
            public void onFailure(Call<OrderResponse> call, Throwable t) {
                completeManualRefresh();
                Toast.makeText(OrderDetailActivity.this, R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void pollOrderStatus() {
        apiService.getOrderById(orderId).enqueue(new Callback<OrderResponse>() {
            @Override
            public void onResponse(Call<OrderResponse> call, Response<OrderResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    return;
                }

                Order order = response.body().data;
                bindOrder(order);
                maybeShowDriverAssignedDialog(order);
                maybeShowDriverDeliveringDialog(order);
                maybeShowDeliveryCompletedDialog(order);
            }

            @Override
            public void onFailure(Call<OrderResponse> call, Throwable t) {
                // Polling is best-effort.
            }
        });
    }

    private void loadTracking(boolean quiet) {
        apiService.getOrderTracking(orderId).enqueue(new Callback<OrderTrackingResponse>() {
            @Override
            public void onResponse(Call<OrderTrackingResponse> call, Response<OrderTrackingResponse> response) {
                completeManualRefresh();
                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    return;
                }

                bindTracking(response.body().data);
            }

            @Override
            public void onFailure(Call<OrderTrackingResponse> call, Throwable t) {
                completeManualRefresh();
            }
        });
    }

    private void pollTracking() {
        if (isFinishing()) {
            return;
        }
        loadTracking(true);
    }

    private void bindTracking(OrderTracking tracking) {
        this.latestTracking = tracking;
        
        String restaurantName = tracking.restaurant != null ? tracking.restaurant.name : "N/A";
        String status = tracking.order != null && tracking.order.statusLabel != null
                ? tracking.order.statusLabel
                : (tracking.order != null ? tracking.order.statusCode : "");
        trackingText.setText(getString(
                R.string.tracking_info,
                restaurantName,
                status
        ) + "\n" + getString(R.string.customer_map_progress, tracking.routeProgress));

        if (mapController == null) {
            return;
        }

        TrackingDriverLocation driverLocation = tracking.driverLocation;
        if (driverLocation != null) {
            simulatedDriverLat = driverLocation.latitude;
            simulatedDriverLng = driverLocation.longitude;
        } else {
            simulatedDriverLat = null;
            simulatedDriverLng = null;
        }

        updateMapWithSimulatedLocation();

        maybeLoadDriverProfile(tracking.driver);

        if (tracking.order != null) {
            maybeShowDriverAssignedDialog(tracking.order);
            maybeShowDriverDeliveringDialog(tracking.order);
            maybeShowDeliveryCompletedDialog(tracking.order);

            // Update cancel button visibility dynamically
            if (tracking.order.driver == null && ("PENDING".equalsIgnoreCase(tracking.order.statusCode) 
                    || "CONFIRMED".equalsIgnoreCase(tracking.order.statusCode) 
                    || "PLACED".equalsIgnoreCase(tracking.order.statusCode) 
                    || "WAITING_FOR_DRIVER".equalsIgnoreCase(tracking.order.statusCode))) {
                cancelOrderButton.setVisibility(View.VISIBLE);
            } else {
                cancelOrderButton.setVisibility(View.GONE);
            }
        }
    }

    private void bindOrder(Order order) {
        codeText.setText(order.orderCode);
        statusText.setText(order.statusLabel != null ? order.statusLabel : order.statusCode);
        addressText.setText(order.receiverAddress);
        totalText.setText(CurrencyUtils.formatVnd(order.totalAmount));

        StringBuilder builder = new StringBuilder();
        if (order.items != null) {
            for (int i = 0; i < order.items.size(); i++) {
                if (i > 0) {
                    builder.append("\n");
                }
                builder.append("- ")
                        .append(order.items.get(i).foodName)
                        .append(" x")
                        .append(order.items.get(i).quantity)
                        .append(" = ")
                        .append(CurrencyUtils.formatVnd(order.items.get(i).lineTotal));
            }
        }
        itemsText.setText(builder.toString());
        maybeLoadDriverProfile(order.driver);

        // Update cancel button visibility
        if (order.driver == null && ("PENDING".equalsIgnoreCase(order.statusCode) 
                || "CONFIRMED".equalsIgnoreCase(order.statusCode) 
                || "PLACED".equalsIgnoreCase(order.statusCode) 
                || "WAITING_FOR_DRIVER".equalsIgnoreCase(order.statusCode))) {
            cancelOrderButton.setVisibility(View.VISIBLE);
        } else {
            cancelOrderButton.setVisibility(View.GONE);
        }
    }

    private void maybeLoadDriverProfile(DriverSummary driver) {
        if (driver == null || driver.id <= 0) {
            if (driverProfileSection != null) {
                driverProfileSection.setVisibility(View.GONE);
            }
            loadedDriverProfileId = -1;
            return;
        }

        if (driver.id == loadedDriverProfileId) {
            return;
        }

        loadedDriverProfileId = driver.id;

        apiService.getDriverProfile(driver.id).enqueue(new Callback<DriverProfileResponse>() {
            @Override
            public void onResponse(Call<DriverProfileResponse> call, Response<DriverProfileResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    bindBasicDriverProfile(driver);
                    return;
                }

                bindDriverProfile(response.body().data);
            }

            @Override
            public void onFailure(Call<DriverProfileResponse> call, Throwable t) {
                bindBasicDriverProfile(driver);
            }
        });
    }

    private void bindBasicDriverProfile(DriverSummary driver) {
        if (driverProfileSection == null || driver == null) {
            return;
        }

        driverProfileSection.setVisibility(View.VISIBLE);
        driverProfileSummaryText.setText(getString(
                R.string.customer_driver_profile_summary,
                safeText(driver.fullName, "Tai xe"),
                safeText(driver.phone, "-"),
                "-",
                driver.isOnline ? getString(R.string.customer_driver_online) : getString(R.string.customer_driver_offline),
                0
        ));
        driverVehicleInfoText.setText(getString(
                R.string.customer_vehicle_info,
                formatVehicleType(driver.vehicleType),
                safeText(driver.licensePlate, "-")
        ));
        driverDeliveriesText.setText(R.string.customer_driver_deliveries_empty);
    }

    private void bindDriverProfile(DriverProfileData profile) {
        if (driverProfileSection == null || profile == null || profile.driver == null) {
            return;
        }

        Driver driver = profile.driver;
        driverProfileSection.setVisibility(View.VISIBLE);
        driverProfileSummaryText.setText(getString(
                R.string.customer_driver_profile_summary,
                safeText(driver.fullName, "Tai xe"),
                safeText(driver.phone, "-"),
                String.format(Locale.US, "%.1f", driver.ratingAvg),
                driver.isOnline ? getString(R.string.customer_driver_online) : getString(R.string.customer_driver_offline),
                profile.completedCount
        ));
        driverVehicleInfoText.setText(getString(
                R.string.customer_vehicle_info,
                formatVehicleType(driver.vehicleType),
                safeText(driver.licensePlate, "-")
        ));

        if (profile.completedDeliveries == null || profile.completedDeliveries.isEmpty()) {
            driverDeliveriesText.setText(R.string.customer_driver_deliveries_empty);
            return;
        }

        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < profile.completedDeliveries.size(); i++) {
            DriverCompletedDelivery delivery = profile.completedDeliveries.get(i);
            if (i > 0) {
                builder.append("\n");
            }
            builder.append(getString(
                    R.string.customer_driver_delivery_line,
                    safeText(delivery.orderCode, "#" + delivery.id),
                    safeText(delivery.restaurantName, "Quan"),
                    CurrencyUtils.formatVnd(delivery.totalAmount)
            ));
        }
        driverDeliveriesText.setText(builder.toString());
    }

    private String safeText(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private String formatVehicleType(String vehicleType) {
        if (vehicleType == null || vehicleType.trim().isEmpty()) {
            return "Chua cap nhat";
        }

        String normalized = vehicleType.trim().toUpperCase(Locale.US);
        if ("MOTORBIKE".equals(normalized) || "MOTO".equals(normalized)) {
            return "Xe may";
        }
        if ("CAR".equals(normalized)) {
            return "O to";
        }
        if ("BICYCLE".equals(normalized)) {
            return "Xe dap";
        }
        return vehicleType;
    }

    private void maybeShowDriverAssignedDialog(Order order) {
        if (driverAssignedDialogShown || order == null || !isDriverAccepted(order.statusCode)) {
            return;
        }

        String driverName = order.driver != null && order.driver.fullName != null && !order.driver.fullName.isEmpty()
                ? order.driver.fullName
                : "Tai xe";
        driverAssignedDialogShown = true;

        new AlertDialog.Builder(this)
                .setTitle(R.string.customer_driver_assigned_title)
                .setMessage(getString(R.string.customer_driver_assigned_message, driverName, order.orderCode))
                .setPositiveButton(R.string.customer_driver_assigned_ok, null)
                .setCancelable(true)
                .show();
    }

    private boolean isDriverAccepted(String statusCode) {
        return "DRIVER_ACCEPTED".equals(statusCode) || "DRIVER_ASSIGNED".equals(statusCode);
    }

    private void maybeShowDriverDeliveringDialog(Order order) {
        if (driverDeliveringDialogShown || order == null || !"DELIVERING".equals(order.statusCode)) {
            return;
        }

        String driverName = order.driver != null && order.driver.fullName != null && !order.driver.fullName.isEmpty()
                ? order.driver.fullName
                : "Tai xe";
        double cashAmount = order.cashToCollect > 0 ? order.cashToCollect : order.totalAmount;
        driverDeliveringDialogShown = true;

        new AlertDialog.Builder(this)
                .setTitle(R.string.customer_driver_delivering_title)
                .setMessage(getString(
                        R.string.customer_driver_delivering_message,
                        driverName,
                        order.orderCode,
                        CurrencyUtils.formatVnd(cashAmount)
                ))
                .setPositiveButton(R.string.customer_driver_assigned_ok, null)
                .setCancelable(true)
                .show();
    }

    private void maybeShowDeliveryCompletedDialog(Order order) {
        if (deliveryCompletedDialogShown || order == null || !"COMPLETED".equals(order.statusCode)) {
            return;
        }

        String driverName = order.driver != null && order.driver.fullName != null && !order.driver.fullName.isEmpty()
                ? order.driver.fullName
                : "Tai xe";
        deliveryCompletedDialogShown = true;

        new AlertDialog.Builder(this)
                .setTitle(R.string.customer_delivery_completed_title)
                .setMessage(getString(
                        R.string.customer_delivery_completed_message,
                        driverName,
                        order.orderCode,
                        CurrencyUtils.formatVnd(order.totalAmount)
                ))
                .setPositiveButton(R.string.customer_driver_assigned_ok, null)
                .setCancelable(true)
                .show();
    }

    private void confirmCancelOrder() {
        new AlertDialog.Builder(this)
                .setTitle("Xác nhận hủy đơn")
                .setMessage("Bạn có chắc chắn muốn hủy đơn hàng này không?")
                .setPositiveButton("Hủy đơn", (dialog, which) -> executeCancelOrder())
                .setNegativeButton("Không", null)
                .show();
    }

    private void executeCancelOrder() {
        progressBar.setVisibility(View.VISIBLE);
        cancelOrderButton.setEnabled(false);
        apiService.cancelOrder(orderId).enqueue(new Callback<OrderResponse>() {
            @Override
            public void onResponse(Call<OrderResponse> call, Response<OrderResponse> response) {
                progressBar.setVisibility(View.GONE);
                cancelOrderButton.setEnabled(true);
                if (!response.isSuccessful()) {
                    Toast.makeText(OrderDetailActivity.this, ApiClient.parseErrorMessage(response), Toast.LENGTH_LONG).show();
                    return;
                }
                Toast.makeText(OrderDetailActivity.this, "Đã hủy đơn hàng thành công", Toast.LENGTH_SHORT).show();
                refreshContent();
            }

            @Override
            public void onFailure(Call<OrderResponse> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                cancelOrderButton.setEnabled(true);
                Toast.makeText(OrderDetailActivity.this, R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }
}
