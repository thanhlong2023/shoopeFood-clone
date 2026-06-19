package com.shoopefood.mobile.ui;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import android.app.AlertDialog;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.view.LayoutInflater;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.shoopefood.mobile.R;
import com.shoopefood.mobile.adapter.CartAdapter;
import com.shoopefood.mobile.cart.CartManager;
import com.shoopefood.mobile.location.DriverLocationHelper;
import com.shoopefood.mobile.model.CreateOrderRequest;
import com.shoopefood.mobile.model.OrderItemRequest;
import com.shoopefood.mobile.model.OrderResponse;
import com.shoopefood.mobile.model.RestaurantResponse;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;
import com.shoopefood.mobile.session.SessionManager;
import com.shoopefood.mobile.util.CurrencyUtils;
import com.shoopefood.mobile.util.GeoUtils;
import com.shoopefood.mobile.util.ShippingFeeUtils;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CartActivity extends AppCompatActivity implements CartAdapter.OnCartChangeListener {

    private CartManager cartManager;
    private SessionManager sessionManager;
    private ApiService apiService;
    private DriverLocationHelper locationHelper;
    private CartAdapter adapter;
    private TextView restaurantText;
    private TextView subtotalText;
    private TextView deliverySummaryText;
    private TextInputEditText addressInput;
    private MaterialButton locationButton;
    private MaterialButton checkoutButton;
    private ProgressBar progressBar;

    private double receiverLat = Double.NaN;
    private double receiverLng = Double.NaN;
    private double deliveryDistanceKm = Double.NaN;

    private ActivityResultLauncher<String> locationPermissionLauncher;
    private ActivityResultLauncher<IntentSenderRequest> locationSettingsLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_cart);

        cartManager = CartManager.getInstance();
        sessionManager = new SessionManager(this);
        apiService = ApiClient.getService(this);
        locationHelper = new DriverLocationHelper(this);

        locationPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestPermission(),
                granted -> {
                    if (granted) {
                        fetchDeliveryLocation();
                    } else {
                        Toast.makeText(this, R.string.customer_location_required, Toast.LENGTH_SHORT).show();
                    }
                }
        );
        locationSettingsLauncher = registerForActivityResult(
                new ActivityResultContracts.StartIntentSenderForResult(),
                result -> {
                    if (result.getResultCode() == Activity.RESULT_OK) {
                        fetchDeliveryLocation();
                    }
                }
        );

        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setTitle(R.string.cart_title);
        }

        restaurantText = findViewById(R.id.textCartRestaurant);
        subtotalText = findViewById(R.id.textCartSubtotal);
        deliverySummaryText = findViewById(R.id.textDeliverySummary);
        addressInput = findViewById(R.id.inputReceiverAddress);
        locationButton = findViewById(R.id.buttonUseDeliveryLocation);
        checkoutButton = findViewById(R.id.buttonCheckout);
        progressBar = findViewById(R.id.progressCart);

        RecyclerView recyclerView = findViewById(R.id.recyclerCart);
        adapter = new CartAdapter(this);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        recyclerView.setAdapter(adapter);

        locationButton.setOnClickListener(v -> requestDeliveryLocation());
        checkoutButton.setOnClickListener(v -> checkout());

        refreshCartUi();
        ensureRestaurantCoordinates();
    }

    @Override
    protected void onDestroy() {
        if (locationHelper != null) {
            locationHelper.stopFetch();
        }
        super.onDestroy();
    }

    @Override
    public boolean onSupportNavigateUp() {
        finish();
        return true;
    }

    @Override
    public void onCartChanged() {
        refreshCartUi();
    }

    private void refreshCartUi() {
        adapter.submitLines(cartManager.getLines());
        restaurantText.setText(cartManager.getRestaurantName());
        subtotalText.setText(getString(R.string.subtotal_label, CurrencyUtils.formatVnd(cartManager.getSubtotal())));
        checkoutButton.setEnabled(!cartManager.isEmpty());
        updateDeliverySummary();
    }

    private void ensureRestaurantCoordinates() {
        if (cartManager.isEmpty() || cartManager.hasRestaurantCoordinates()) {
            return;
        }

        apiService.getRestaurantById(cartManager.getRestaurantId()).enqueue(new Callback<RestaurantResponse>() {
            @Override
            public void onResponse(Call<RestaurantResponse> call, Response<RestaurantResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    return;
                }
                cartManager.setRestaurant(
                        cartManager.getRestaurantId(),
                        cartManager.getRestaurantName(),
                        response.body().data.latitude,
                        response.body().data.longitude
                );
                recalculateDeliveryDistance();
            }

            @Override
            public void onFailure(Call<RestaurantResponse> call, Throwable t) {
            }
        });
    }

    private void requestDeliveryLocation() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION);
            return;
        }
        fetchDeliveryLocation();
    }

    private void fetchDeliveryLocation() {
        locationButton.setEnabled(false);
        locationButton.setText(R.string.customer_fetching_location);

        locationHelper.ensureLocationEnabled(
                this,
                () -> locationHelper.fetchCurrentLocation(this, new DriverLocationHelper.OnLocationResult() {
                    @Override
                    public void onSuccess(double latitude, double longitude, float accuracyMeters) {
                        receiverLat = latitude;
                        receiverLng = longitude;
                        recalculateDeliveryDistance();
                        locationButton.setEnabled(true);
                        locationButton.setText(R.string.customer_use_delivery_location);
                    }

                    @Override
                    public void onError(String message) {
                        locationButton.setEnabled(true);
                        locationButton.setText(R.string.customer_use_delivery_location);
                        Toast.makeText(CartActivity.this, message, Toast.LENGTH_LONG).show();
                    }
                }),
                exception -> {
                    try {
                        locationSettingsLauncher.launch(
                                new IntentSenderRequest.Builder(exception.getResolution()).build()
                        );
                    } catch (Exception error) {
                        locationButton.setEnabled(true);
                        locationButton.setText(R.string.customer_use_delivery_location);
                        Toast.makeText(this, R.string.driver_location_disabled, Toast.LENGTH_LONG).show();
                    }
                },
                () -> {
                    locationButton.setEnabled(true);
                    locationButton.setText(R.string.customer_use_delivery_location);
                    Toast.makeText(this, R.string.driver_location_disabled, Toast.LENGTH_LONG).show();
                }
        );
    }

    private void recalculateDeliveryDistance() {
        if (!GeoUtils.isValidCoordinate(receiverLat, receiverLng)
                || !cartManager.hasRestaurantCoordinates()) {
            deliveryDistanceKm = Double.NaN;
            updateDeliverySummary();
            return;
        }

        deliveryDistanceKm = GeoUtils.distanceKm(
                cartManager.getRestaurantLatitude(),
                cartManager.getRestaurantLongitude(),
                receiverLat,
                receiverLng
        );
        updateDeliverySummary();
    }

    private void updateDeliverySummary() {
        if (!Double.isFinite(deliveryDistanceKm)) {
            deliverySummaryText.setText(R.string.customer_delivery_pending);
            return;
        }

        double estimatedFee = ShippingFeeUtils.estimateStandardFee(deliveryDistanceKm);
        deliverySummaryText.setText(getString(
                R.string.customer_delivery_summary,
                deliveryDistanceKm,
                CurrencyUtils.formatVnd(estimatedFee)
        ));
    }

    private void checkout() {
        if (cartManager.isEmpty() || sessionManager.getUser() == null) {
            Toast.makeText(this, R.string.cart_empty, Toast.LENGTH_SHORT).show();
            return;
        }

        String address = addressInput.getText() != null ? addressInput.getText().toString().trim() : "";
        if (address.isEmpty()) {
            Toast.makeText(this, R.string.checkout_required, Toast.LENGTH_SHORT).show();
            return;
        }

        if (!GeoUtils.isValidCoordinate(receiverLat, receiverLng) || !Double.isFinite(deliveryDistanceKm)) {
            Toast.makeText(this, R.string.customer_location_required, Toast.LENGTH_SHORT).show();
            return;
        }

        List<OrderItemRequest> items = new ArrayList<>();
        for (CartManager.CartLine line : cartManager.getLines()) {
            items.add(new OrderItemRequest(line.food.id, line.quantity));
        }

        CreateOrderRequest request = new CreateOrderRequest(
                sessionManager.getUser().id,
                cartManager.getRestaurantId(),
                address,
                receiverLat,
                receiverLng,
                deliveryDistanceKm,
                "STANDARD",
                items
        );

        setLoading(true);

        apiService.createOrder(request).enqueue(new Callback<OrderResponse>() {
            @Override
            public void onResponse(Call<OrderResponse> call, Response<OrderResponse> response) {
                setLoading(false);

                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    showErrorDialog(ApiClient.parseErrorMessage(response));
                    return;
                }

                cartManager.clear();
                Toast.makeText(CartActivity.this, R.string.order_success, Toast.LENGTH_LONG).show();

                Intent intent = new Intent(CartActivity.this, OrderDetailActivity.class);
                intent.putExtra(OrderDetailActivity.EXTRA_ORDER_ID, response.body().data.id);
                startActivity(intent);
                finish();
            }

            @Override
            public void onFailure(Call<OrderResponse> call, Throwable t) {
                setLoading(false);
                Toast.makeText(CartActivity.this, R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void setLoading(boolean loading) {
        progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        checkoutButton.setEnabled(!loading && !cartManager.isEmpty());
    }

    private void showErrorDialog(String message) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        View dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_error, null);
        builder.setView(dialogView);
        
        AlertDialog dialog = builder.create();
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        }

        TextView textMessage = dialogView.findViewById(R.id.textErrorMessage);
        textMessage.setText(message);

        MaterialButton btnClose = dialogView.findViewById(R.id.buttonCloseDialog);
        btnClose.setOnClickListener(v -> dialog.dismiss());

        dialog.show();
    }
}
