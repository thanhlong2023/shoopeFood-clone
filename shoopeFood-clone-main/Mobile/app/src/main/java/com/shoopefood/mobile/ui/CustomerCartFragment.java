package com.shoopefood.mobile.ui;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;
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

public class CustomerCartFragment extends Fragment implements CartAdapter.OnCartChangeListener {

    private CustomerHomeHost host;
    private CartManager cartManager;
    private SessionManager sessionManager;
    private ApiService apiService;
    private DriverLocationHelper locationHelper;
    private CartAdapter adapter;
    private TextView restaurantText;
    private TextView subtotalText;
    private TextView emptyText;
    private TextView deliverySummaryText;
    private TextInputEditText addressInput;
    private TextInputLayout addressLayout;
    private MaterialButton locationButton;
    private MaterialButton checkoutButton;
    private ProgressBar progressBar;

    private double receiverLat = Double.NaN;
    private double receiverLng = Double.NaN;
    private double deliveryDistanceKm = Double.NaN;

    private ActivityResultLauncher<String> locationPermissionLauncher;
    private ActivityResultLauncher<IntentSenderRequest> locationSettingsLauncher;

    @Override
    public void onAttach(@NonNull android.content.Context context) {
        super.onAttach(context);
        if (!(context instanceof CustomerHomeHost)) {
            throw new IllegalStateException("Host must implement CustomerHomeHost");
        }
        host = (CustomerHomeHost) context;
    }

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        locationHelper = new DriverLocationHelper(requireContext());
        locationPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestPermission(),
                granted -> {
                    if (granted) {
                        fetchDeliveryLocation();
                    } else {
                        Toast.makeText(requireContext(), R.string.customer_location_required, Toast.LENGTH_SHORT).show();
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
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_customer_cart, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        cartManager = CartManager.getInstance();
        sessionManager = new SessionManager(requireContext());
        apiService = ApiClient.getService(requireContext());

        restaurantText = view.findViewById(R.id.textCartRestaurant);
        subtotalText = view.findViewById(R.id.textCartSubtotal);
        emptyText = view.findViewById(R.id.textCartEmpty);
        deliverySummaryText = view.findViewById(R.id.textDeliverySummary);
        addressInput = view.findViewById(R.id.inputReceiverAddress);
        addressLayout = view.findViewById(R.id.layoutReceiverAddress);
        locationButton = view.findViewById(R.id.buttonUseDeliveryLocation);
        checkoutButton = view.findViewById(R.id.buttonCheckout);
        progressBar = view.findViewById(R.id.progressCart);

        RecyclerView recyclerView = view.findViewById(R.id.recyclerCart);
        adapter = new CartAdapter(this);
        recyclerView.setLayoutManager(new LinearLayoutManager(requireContext()));
        recyclerView.setAdapter(adapter);

        locationButton.setOnClickListener(v -> requestDeliveryLocation());
        checkoutButton.setOnClickListener(v -> checkout());
        refreshCartUi();
        ensureRestaurantCoordinates();
    }

    @Override
    public void onDestroyView() {
        if (locationHelper != null) {
            locationHelper.stopFetch();
        }
        super.onDestroyView();
    }

    @Override
    public void onResume() {
        super.onResume();
        refreshCartUi();
        notifyHostBadge();
        ensureRestaurantCoordinates();
    }

    @Override
    public void onCartChanged() {
        refreshCartUi();
        notifyHostBadge();
    }

    private void notifyHostBadge() {
        if (host != null) {
            host.refreshCartBadge();
        }
    }

    public void refreshCartUi() {
        boolean isEmpty = cartManager.isEmpty();
        adapter.submitLines(cartManager.getLines());
        restaurantText.setText(isEmpty ? getString(R.string.cart_title) : cartManager.getRestaurantName());
        subtotalText.setText(getString(R.string.subtotal_label, CurrencyUtils.formatVnd(cartManager.getSubtotal())));
        emptyText.setVisibility(isEmpty ? View.VISIBLE : View.GONE);
        int deliveryVisibility = isEmpty ? View.GONE : View.VISIBLE;
        addressLayout.setVisibility(deliveryVisibility);
        locationButton.setVisibility(deliveryVisibility);
        deliverySummaryText.setVisibility(deliveryVisibility);
        checkoutButton.setEnabled(!isEmpty);
        checkoutButton.setVisibility(isEmpty ? View.GONE : View.VISIBLE);
        updateDeliverySummary();
    }

    private void ensureRestaurantCoordinates() {
        if (cartManager.isEmpty() || cartManager.hasRestaurantCoordinates()) {
            return;
        }

        apiService.getRestaurantById(cartManager.getRestaurantId()).enqueue(new Callback<RestaurantResponse>() {
            @Override
            public void onResponse(@NonNull Call<RestaurantResponse> call, @NonNull Response<RestaurantResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    return;
                }
                cartManager.setRestaurant(
                        cartManager.getRestaurantId(),
                        cartManager.getRestaurantName(),
                        response.body().data.latitude,
                        response.body().data.longitude
                );
                updateDeliverySummary();
            }

            @Override
            public void onFailure(@NonNull Call<RestaurantResponse> call, @NonNull Throwable t) {
            }
        });
    }

    private void requestDeliveryLocation() {
        if (ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION)
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
                requireContext(),
                () -> locationHelper.fetchCurrentLocation(requireContext(), new DriverLocationHelper.OnLocationResult() {
                    @Override
                    public void onSuccess(double latitude, double longitude, float accuracyMeters) {
                        if (!isAdded()) {
                            return;
                        }
                        receiverLat = latitude;
                        receiverLng = longitude;
                        recalculateDeliveryDistance();
                        locationButton.setEnabled(true);
                        locationButton.setText(R.string.customer_use_delivery_location);
                    }

                    @Override
                    public void onError(String message) {
                        if (!isAdded()) {
                            return;
                        }
                        locationButton.setEnabled(true);
                        locationButton.setText(R.string.customer_use_delivery_location);
                        Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show();
                    }
                }),
                exception -> {
                    if (!isAdded()) {
                        return;
                    }
                    try {
                        locationSettingsLauncher.launch(
                                new IntentSenderRequest.Builder(exception.getResolution()).build()
                        );
                    } catch (Exception error) {
                        locationButton.setEnabled(true);
                        locationButton.setText(R.string.customer_use_delivery_location);
                        Toast.makeText(requireContext(), R.string.driver_location_disabled, Toast.LENGTH_LONG).show();
                    }
                },
                () -> {
                    if (!isAdded()) {
                        return;
                    }
                    locationButton.setEnabled(true);
                    locationButton.setText(R.string.customer_use_delivery_location);
                    Toast.makeText(requireContext(), R.string.driver_location_disabled, Toast.LENGTH_LONG).show();
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
        if (deliverySummaryText == null) {
            return;
        }

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
            Toast.makeText(requireContext(), R.string.cart_empty, Toast.LENGTH_SHORT).show();
            return;
        }

        String address = addressInput.getText() != null ? addressInput.getText().toString().trim() : "";
        if (address.isEmpty()) {
            Toast.makeText(requireContext(), R.string.checkout_required, Toast.LENGTH_SHORT).show();
            return;
        }

        if (!GeoUtils.isValidCoordinate(receiverLat, receiverLng) || !Double.isFinite(deliveryDistanceKm)) {
            Toast.makeText(requireContext(), R.string.customer_location_required, Toast.LENGTH_SHORT).show();
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
            public void onResponse(@NonNull Call<OrderResponse> call, @NonNull Response<OrderResponse> response) {
                setLoading(false);

                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    Toast.makeText(requireContext(), ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                    return;
                }

                int orderId = response.body().data.id;
                cartManager.clear();
                receiverLat = Double.NaN;
                receiverLng = Double.NaN;
                deliveryDistanceKm = Double.NaN;
                refreshCartUi();
                notifyHostBadge();
                Toast.makeText(requireContext(), R.string.order_success, Toast.LENGTH_LONG).show();

                Intent intent = new Intent(requireContext(), OrderDetailActivity.class);
                intent.putExtra(OrderDetailActivity.EXTRA_ORDER_ID, orderId);
                startActivity(intent);

                if (host != null) {
                    host.showOrdersTab();
                }
            }

            @Override
            public void onFailure(@NonNull Call<OrderResponse> call, @NonNull Throwable t) {
                setLoading(false);
                Toast.makeText(requireContext(), R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void setLoading(boolean loading) {
        progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        checkoutButton.setEnabled(!loading && !cartManager.isEmpty());
    }
}
