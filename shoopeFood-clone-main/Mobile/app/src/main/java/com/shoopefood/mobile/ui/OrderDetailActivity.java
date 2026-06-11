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
    private static final long POLL_INTERVAL_MS = 3000L;

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

        refreshContent();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mapController != null) {
            mapController.onResume();
        }
        pollHandler.post(pollRunnable);
    }

    @Override
    protected void onPause() {
        pollHandler.removeCallbacks(pollRunnable);
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

        List<TrackingRouteLeg> legs = CustomerTrackingRouteUtils.resolveLegs(tracking);
        TrackingDriverLocation driverLocation = tracking.driverLocation;
        Double driverLat = driverLocation != null ? driverLocation.latitude : null;
        Double driverLng = driverLocation != null ? driverLocation.longitude : null;
        String driverName = tracking.driver != null ? tracking.driver.fullName : null;

        double restaurantLat = tracking.restaurant != null ? tracking.restaurant.latitude : 0;
        double restaurantLng = tracking.restaurant != null ? tracking.restaurant.longitude : 0;
        Double customerLat = tracking.destination != null ? tracking.destination.latitude : null;
        Double customerLng = tracking.destination != null ? tracking.destination.longitude : null;

        mapController.showTracking(new CustomerTrackingMapController.TrackingSnapshot(
                driverLat,
                driverLng,
                driverName,
                restaurantName,
                restaurantLat,
                restaurantLng,
                customerLat,
                customerLng,
                legs
        ));

        maybeLoadDriverProfile(tracking.driver);

        if (tracking.order != null) {
            maybeShowDriverAssignedDialog(tracking.order);
            maybeShowDriverDeliveringDialog(tracking.order);
            maybeShowDeliveryCompletedDialog(tracking.order);
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
}
