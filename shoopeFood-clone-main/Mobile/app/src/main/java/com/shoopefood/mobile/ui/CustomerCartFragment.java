package com.shoopefood.mobile.ui;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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
import com.shoopefood.mobile.model.AuthUser;
import com.shoopefood.mobile.model.CreateOrderRequest;
import com.shoopefood.mobile.model.DrivingRouteResponse;
import com.shoopefood.mobile.model.OrderItemRequest;
import com.shoopefood.mobile.model.OrderResponse;
import com.shoopefood.mobile.model.RestaurantResponse;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;
import com.shoopefood.mobile.session.SessionManager;
import com.shoopefood.mobile.util.CurrencyUtils;
import com.shoopefood.mobile.util.GeoUtils;
import com.shoopefood.mobile.util.ShippingFeeUtils;

import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Marker;
import org.osmdroid.views.overlay.MapEventsOverlay;
import org.osmdroid.events.MapEventsReceiver;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.util.BoundingBox;
import com.shoopefood.mobile.util.MapMarkerUtils;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CustomerCartFragment extends Fragment implements CartAdapter.OnCartChangeListener {

    private static final boolean USE_MOCK_API = true;

    private CustomerHomeHost host;
    private CartManager cartManager;
    private SessionManager sessionManager;
    private MapView mapView;
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

    // New views for layout improvements
    private TextView textReceiverInfo;
    private TextView textBreakdownSubtotal;
    private TextView textBreakdownShippingFee;
    private TextView textBreakdownGrandTotal;
    private View cardDeliveryAddress;
    private View cardPricingBreakdown;

    // Address Suggestion variables
    private RecyclerView suggestionsRecyclerView;
    private List<AddressSuggestion> suggestionsList;
    private AddressSuggestionAdapter suggestionsAdapter;
    private android.text.TextWatcher addressTextWatcher;
    private okhttp3.Call activeSearchCall;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable searchRunnable;

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

        // Bind new UI components
        textReceiverInfo = view.findViewById(R.id.textReceiverInfo);
        textBreakdownSubtotal = view.findViewById(R.id.textBreakdownSubtotal);
        textBreakdownShippingFee = view.findViewById(R.id.textBreakdownShippingFee);
        textBreakdownGrandTotal = view.findViewById(R.id.textBreakdownGrandTotal);
        cardDeliveryAddress = view.findViewById(R.id.cardDeliveryAddress);
        cardPricingBreakdown = view.findViewById(R.id.cardPricingBreakdown);

        // Set up Autocomplete Suggestions
        suggestionsRecyclerView = view.findViewById(R.id.recyclerAddressSuggestions);
        suggestionsList = new ArrayList<>();
        suggestionsAdapter = new AddressSuggestionAdapter(suggestionsList, suggestion -> {
            // Disable TextWatcher temporarily to prevent loop
            addressInput.removeTextChangedListener(addressTextWatcher);
            addressInput.setText(suggestion.address);
            addressInput.addTextChangedListener(addressTextWatcher);
            
            // Set coordinates
            receiverLat = suggestion.latitude;
            receiverLng = suggestion.longitude;
            
            // Recalculate distance
            recalculateDeliveryDistance();
            updateMapOverlays();
            
            // Hide suggestions list
            suggestionsRecyclerView.setVisibility(View.GONE);
            suggestionsList.clear();
            suggestionsAdapter.notifyDataSetChanged();
        });
        suggestionsRecyclerView.setLayoutManager(new LinearLayoutManager(requireContext()));
        suggestionsRecyclerView.setAdapter(suggestionsAdapter);

        // Setup Map View
        setupMap(view);

        addressTextWatcher = new android.text.TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                searchAddress(s.toString());
            }

            @Override
            public void afterTextChanged(android.text.Editable s) {}
        };
        addressInput.addTextChangedListener(addressTextWatcher);

        RecyclerView recyclerView = view.findViewById(R.id.recyclerCart);
        adapter = new CartAdapter(this);
        recyclerView.setLayoutManager(new LinearLayoutManager(requireContext()));
        recyclerView.setAdapter(adapter);

        locationButton.setOnClickListener(v -> requestDeliveryLocation());
        checkoutButton.setOnClickListener(v -> checkout());
        refreshCartUi();
        ensureRestaurantCoordinates();
        if (USE_MOCK_API && (Double.isNaN(receiverLat) || Double.isNaN(receiverLng))) {
            mockLocationAndCalculate();
        }
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
        if (mapView != null) {
            mapView.onResume();
        }
        refreshCartUi();
        notifyHostBadge();
        ensureRestaurantCoordinates();
        if (USE_MOCK_API && (Double.isNaN(receiverLat) || Double.isNaN(receiverLng))) {
            mockLocationAndCalculate();
        } else {
            updateMapOverlays();
        }
    }

    @Override
    public void onPause() {
        if (mapView != null) {
            mapView.onPause();
        }
        super.onPause();
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

        // Update recipient info card header
        AuthUser user = sessionManager.getUser();
        if (user != null && textReceiverInfo != null) {
            textReceiverInfo.setText("Người nhận: " + user.fullName + " | SĐT: " + user.phone);
        }

        subtotalText.setText(getString(R.string.subtotal_label, CurrencyUtils.formatVnd(cartManager.getSubtotal())));
        emptyText.setVisibility(isEmpty ? View.VISIBLE : View.GONE);
        
        int deliveryVisibility = isEmpty ? View.GONE : View.VISIBLE;
        if (cardDeliveryAddress != null) {
            cardDeliveryAddress.setVisibility(deliveryVisibility);
        }
        if (cardPricingBreakdown != null) {
            cardPricingBreakdown.setVisibility(deliveryVisibility);
        }

        addressLayout.setVisibility(deliveryVisibility);
        locationButton.setVisibility(deliveryVisibility);
        deliverySummaryText.setVisibility(deliveryVisibility);
        checkoutButton.setEnabled(!isEmpty);
        checkoutButton.setVisibility(isEmpty ? View.GONE : View.VISIBLE);
        updateDeliverySummary();
    }

    private void mockLocationAndCalculate() {
        receiverLat = 10.7769; // Mock coordinates (Saigon Centre)
        receiverLng = 106.7009;
        if (addressInput != null && (addressInput.getText() == null || addressInput.getText().toString().trim().isEmpty())) {
            addressInput.setText("123 Nguyễn Huệ, Bến Nghé, Quận 1, Hồ Chí Minh");
        }
        recalculateDeliveryDistance();
        updateMapOverlays();
    }

    private void ensureRestaurantCoordinates() {
        if (cartManager.isEmpty() || cartManager.hasRestaurantCoordinates()) {
            if (USE_MOCK_API && (Double.isNaN(receiverLat) || Double.isNaN(receiverLng))) {
                mockLocationAndCalculate();
            } else {
                updateMapOverlays();
            }
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
                if (USE_MOCK_API) {
                    mockLocationAndCalculate();
                } else {
                    updateDeliverySummary();
                    updateMapOverlays();
                }
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
                        reverseGeocode(latitude, longitude);
                        locationButton.setEnabled(true);
                        locationButton.setText(R.string.customer_use_delivery_location);
                        updateMapOverlays();
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

        apiService.getRoute(
                cartManager.getRestaurantLatitude(),
                cartManager.getRestaurantLongitude(),
                receiverLat,
                receiverLng
        ).enqueue(new Callback<DrivingRouteResponse>() {
            @Override
            public void onResponse(@NonNull Call<DrivingRouteResponse> call, @NonNull Response<DrivingRouteResponse> response) {
                if (response.isSuccessful() && response.body() != null && response.body().data != null) {
                    deliveryDistanceKm = response.body().data.distanceKm;
                } else {
                    // Fallback to Haversine straight line if OSRM fails
                    deliveryDistanceKm = GeoUtils.distanceKm(
                            cartManager.getRestaurantLatitude(),
                            cartManager.getRestaurantLongitude(),
                            receiverLat,
                            receiverLng
                    );
                }
                updateDeliverySummary();
            }

            @Override
            public void onFailure(@NonNull Call<DrivingRouteResponse> call, @NonNull Throwable t) {
                // Fallback to Haversine straight line if network fails
                deliveryDistanceKm = GeoUtils.distanceKm(
                        cartManager.getRestaurantLatitude(),
                        cartManager.getRestaurantLongitude(),
                        receiverLat,
                        receiverLng
                );
                updateDeliverySummary();
            }
        });
    }

    private void updateDeliverySummary() {
        double subtotal = cartManager.getSubtotal();
        if (textBreakdownSubtotal != null) {
            textBreakdownSubtotal.setText(CurrencyUtils.formatVnd(subtotal));
        }

        if (deliverySummaryText != null) {
            if (!Double.isFinite(deliveryDistanceKm)) {
                deliverySummaryText.setText(R.string.customer_delivery_pending);
            } else {
                double estimatedFee = ShippingFeeUtils.estimateStandardFee(deliveryDistanceKm);
                deliverySummaryText.setText(getString(
                        R.string.customer_delivery_summary,
                        deliveryDistanceKm,
                        CurrencyUtils.formatVnd(estimatedFee)
                ));
            }
        }

        if (!Double.isFinite(deliveryDistanceKm)) {
            if (textBreakdownShippingFee != null) {
                textBreakdownShippingFee.setText("Chưa xác định");
            }
            if (textBreakdownGrandTotal != null) {
                textBreakdownGrandTotal.setText(CurrencyUtils.formatVnd(subtotal));
            }
            return;
        }

        double estimatedFee = ShippingFeeUtils.estimateStandardFee(deliveryDistanceKm);
        if (textBreakdownShippingFee != null) {
            textBreakdownShippingFee.setText(CurrencyUtils.formatVnd(estimatedFee));
        }
        if (textBreakdownGrandTotal != null) {
            textBreakdownGrandTotal.setText(CurrencyUtils.formatVnd(subtotal + estimatedFee));
        }
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

    private void reverseGeocode(double lat, double lng) {
        String url = "https://nominatim.openstreetmap.org/reverse?format=json&lat=" + lat + "&lon=" + lng + "&zoom=18&addressdetails=1";
        android.util.Log.d("ApiClient", "reverseGeocode - URL: " + url);
        okhttp3.Request request = new okhttp3.Request.Builder()
                .url(url)
                .addHeader("User-Agent", "ShoopeFoodMobile/1.0")
                .build();

        okhttp3.OkHttpClient client = new okhttp3.OkHttpClient();
        client.newCall(request).enqueue(new okhttp3.Callback() {
            @Override
            public void onFailure(@NonNull okhttp3.Call call, @NonNull java.io.IOException e) {
                android.util.Log.e("ApiClient", "reverseGeocode - Request failed: " + e.getMessage());
            }

            @Override
            public void onResponse(@NonNull okhttp3.Call call, @NonNull okhttp3.Response response) throws java.io.IOException {
                android.util.Log.d("ApiClient", "reverseGeocode - Response code: " + response.code());
                if (!response.isSuccessful() || response.body() == null) {
                    android.util.Log.w("ApiClient", "reverseGeocode - Response body null or unsuccessful");
                    return;
                }

                try {
                    String bodyString = response.body().string();
                    android.util.Log.d("ApiClient", "reverseGeocode - Response body: " + bodyString);
                    com.google.gson.JsonObject jsonObject = new com.google.gson.Gson().fromJson(bodyString, com.google.gson.JsonObject.class);
                    if (jsonObject != null && jsonObject.has("display_name")) {
                        String displayName = jsonObject.get("display_name").getAsString();
                        mainHandler.post(() -> {
                            if (addressInput != null) {
                                addressInput.removeTextChangedListener(addressTextWatcher);
                                addressInput.setText(displayName);
                                addressInput.addTextChangedListener(addressTextWatcher);
                                android.util.Log.d("ApiClient", "reverseGeocode - Updated address text to: " + displayName);
                            }
                        });
                    }
                } catch (Exception e) {
                    android.util.Log.e("ApiClient", "reverseGeocode - Parsing error: " + e.getMessage(), e);
                }
            }
        });
    }

    private void searchAddress(String query) {
        if (activeSearchCall != null) {
            activeSearchCall.cancel();
        }

        if (query.trim().length() < 3) {
            suggestionsList.clear();
            suggestionsAdapter.notifyDataSetChanged();
            suggestionsRecyclerView.setVisibility(View.GONE);
            return;
        }

        if (searchRunnable != null) {
            mainHandler.removeCallbacks(searchRunnable);
        }

        searchRunnable = () -> {
            String url = "https://photon.komoot.io/api/?q=" + android.net.Uri.encode(query) + "&limit=5&lang=vi&countrycode=VN";
            android.util.Log.d("ApiClient", "searchAddress - URL: " + url);
            okhttp3.Request request = new okhttp3.Request.Builder()
                    .url(url)
                    .addHeader("User-Agent", "ShoopeFoodMobile/1.0")
                    .build();

            okhttp3.OkHttpClient client = new okhttp3.OkHttpClient();
            activeSearchCall = client.newCall(request);
            activeSearchCall.enqueue(new okhttp3.Callback() {
                @Override
                public void onFailure(@NonNull okhttp3.Call call, @NonNull java.io.IOException e) {
                    android.util.Log.e("ApiClient", "searchAddress - Request failed: " + e.getMessage() + ". Trying Nominatim...");
                    searchAddressNominatim(query);
                }

                @Override
                public void onResponse(@NonNull okhttp3.Call call, @NonNull okhttp3.Response response) throws java.io.IOException {
                    android.util.Log.d("ApiClient", "searchAddress - Response code: " + response.code());
                    if (!response.isSuccessful() || response.body() == null) {
                        android.util.Log.w("ApiClient", "searchAddress - Response unsuccessful or body null. Trying Nominatim...");
                        searchAddressNominatim(query);
                        return;
                    }

                    try {
                        String bodyString = response.body().string();
                        android.util.Log.d("ApiClient", "searchAddress - Response body: " + bodyString);
                        com.google.gson.JsonObject jsonObject = new com.google.gson.JsonObject();
                        try {
                            jsonObject = new com.google.gson.Gson().fromJson(bodyString, com.google.gson.JsonObject.class);
                        } catch (Exception ignored) {}
                        com.google.gson.JsonArray features = jsonObject.getAsJsonArray("features");
                        
                        List<AddressSuggestion> newSuggestions = new ArrayList<>();
                        if (features != null) {
                            android.util.Log.d("ApiClient", "searchAddress - Suggestions count: " + features.size());
                            for (int i = 0; i < features.size(); i++) {
                                com.google.gson.JsonObject feature = features.get(i).getAsJsonObject();
                                com.google.gson.JsonObject geometry = feature.getAsJsonObject("geometry");
                                com.google.gson.JsonArray coordinates = geometry.getAsJsonArray("coordinates");
                                com.google.gson.JsonObject properties = feature.getAsJsonObject("properties");

                                double lng = coordinates.get(0).getAsDouble();
                                double lat = coordinates.get(1).getAsDouble();

                                String name = properties.has("name") ? properties.get("name").getAsString() : "";
                                String street = properties.has("street") ? properties.get("street").getAsString() : "";
                                String city = properties.has("city") ? properties.get("city").getAsString() : "";
                                String country = properties.has("country") ? properties.get("country").getAsString() : "";

                                StringBuilder sb = new StringBuilder(name);
                                if (!street.isEmpty() && !name.contains(street)) {
                                    sb.append(", ").append(street);
                                }
                                if (!city.isEmpty()) {
                                    sb.append(", ").append(city);
                                }
                                if (!country.isEmpty()) {
                                    sb.append(", ").append(country);
                                }

                                newSuggestions.add(new AddressSuggestion(sb.toString(), lat, lng));
                            }
                        }

                        if (newSuggestions.isEmpty()) {
                            android.util.Log.d("ApiClient", "searchAddress - No suggestions from Photon. Trying Nominatim...");
                            searchAddressNominatim(query);
                            return;
                        }

                        mainHandler.post(() -> {
                            suggestionsList.clear();
                            suggestionsList.addAll(newSuggestions);
                            suggestionsAdapter.notifyDataSetChanged();
                            suggestionsRecyclerView.setVisibility(suggestionsList.isEmpty() ? View.GONE : View.VISIBLE);
                            android.util.Log.d("ApiClient", "searchAddress - UI Updated. List visibility: " + (suggestionsList.isEmpty() ? "GONE" : "VISIBLE"));
                        });

                    } catch (Exception e) {
                        android.util.Log.e("ApiClient", "searchAddress - Parsing error: " + e.getMessage() + ". Trying Nominatim...", e);
                        searchAddressNominatim(query);
                    }
                }
            });
        };

        mainHandler.postDelayed(searchRunnable, 300);
    }

    private void searchAddressNominatim(String query) {
        String url = "https://nominatim.openstreetmap.org/search?format=json&q=" + android.net.Uri.encode(query) + "&limit=5&accept-language=vi&countrycodes=vn";
        android.util.Log.d("ApiClient", "searchAddressNominatim - URL: " + url);
        okhttp3.Request request = new okhttp3.Request.Builder()
                .url(url)
                .addHeader("User-Agent", "ShoopeFoodMobile/1.0")
                .build();

        okhttp3.OkHttpClient client = new okhttp3.OkHttpClient();
        activeSearchCall = client.newCall(request);
        activeSearchCall.enqueue(new okhttp3.Callback() {
            @Override
            public void onFailure(@NonNull okhttp3.Call call, @NonNull java.io.IOException e) {
                android.util.Log.e("ApiClient", "searchAddressNominatim - Request failed: " + e.getMessage());
            }

            @Override
            public void onResponse(@NonNull okhttp3.Call call, @NonNull okhttp3.Response response) throws java.io.IOException {
                android.util.Log.d("ApiClient", "searchAddressNominatim - Response code: " + response.code());
                if (!response.isSuccessful() || response.body() == null) {
                    return;
                }
                try {
                    String bodyString = response.body().string();
                    android.util.Log.d("ApiClient", "searchAddressNominatim - Response body: " + bodyString);
                    com.google.gson.JsonArray array = new com.google.gson.Gson().fromJson(bodyString, com.google.gson.JsonArray.class);
                    List<AddressSuggestion> newSuggestions = new ArrayList<>();
                    if (array != null) {
                        for (int i = 0; i < array.size(); i++) {
                            com.google.gson.JsonObject item = array.get(i).getAsJsonObject();
                            double lat = item.get("lat").getAsDouble();
                            double lng = item.get("lon").getAsDouble();
                            String displayName = item.get("display_name").getAsString();
                            newSuggestions.add(new AddressSuggestion(displayName, lat, lng));
                        }
                    }
                    mainHandler.post(() -> {
                        suggestionsList.clear();
                        suggestionsList.addAll(newSuggestions);
                        suggestionsAdapter.notifyDataSetChanged();
                        suggestionsRecyclerView.setVisibility(suggestionsList.isEmpty() ? View.GONE : View.VISIBLE);
                        android.util.Log.d("ApiClient", "searchAddressNominatim - UI Updated. List visibility: " + (suggestionsList.isEmpty() ? "GONE" : "VISIBLE"));
                    });
                } catch (Exception e) {
                    android.util.Log.e("ApiClient", "searchAddressNominatim - Parsing error: " + e.getMessage(), e);
                }
            }
        });
    }

    private void setupMap(View view) {
        mapView = view.findViewById(R.id.mapCart);
        if (mapView == null) return;

        org.osmdroid.tileprovider.tilesource.XYTileSource tileSource = new org.osmdroid.tileprovider.tilesource.XYTileSource(
                "CartoVoyager",
                0,
                20,
                256,
                ".png",
                new String[]{"https://a.basemaps.cartocdn.com/rastertiles/voyager/"},
                "OpenStreetMap contributors, CARTO"
        );

        mapView.setTileSource(tileSource);
        mapView.setMultiTouchControls(true);
        mapView.setHorizontalMapRepetitionEnabled(false);
        mapView.setVerticalMapRepetitionEnabled(false);
        mapView.getController().setZoom(14.0);

        // Tap overlay
        MapEventsOverlay mapEventsOverlay = new MapEventsOverlay(new MapEventsReceiver() {
            @Override
            public boolean singleTapConfirmedHelper(GeoPoint p) {
                receiverLat = p.getLatitude();
                receiverLng = p.getLongitude();
                updateMapOverlays();
                recalculateDeliveryDistance();
                reverseGeocode(receiverLat, receiverLng);
                return true;
            }

            @Override
            public boolean longPressHelper(GeoPoint p) {
                return false;
            }
        });
        mapView.getOverlays().add(0, mapEventsOverlay);
    }

    private void updateMapOverlays() {
        if (mapView == null || !isAdded()) return;

        // Clear all markers/overlays except MapEventsOverlay
        List<org.osmdroid.views.overlay.Overlay> toRemove = new ArrayList<>();
        for (org.osmdroid.views.overlay.Overlay overlay : mapView.getOverlays()) {
            if (!(overlay instanceof MapEventsOverlay)) {
                toRemove.add(overlay);
            }
        }
        mapView.getOverlays().removeAll(toRemove);

        List<GeoPoint> boundsPoints = new ArrayList<>();

        // 1. Add Restaurant Marker
        if (cartManager.hasRestaurantCoordinates()) {
            double resLat = cartManager.getRestaurantLatitude();
            double resLng = cartManager.getRestaurantLongitude();
            GeoPoint resPoint = new GeoPoint(resLat, resLng);
            boundsPoints.add(resPoint);

            Marker resMarker = new Marker(mapView);
            resMarker.setPosition(resPoint);
            resMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
            resMarker.setTitle(cartManager.getRestaurantName());
            resMarker.setIcon(MapMarkerUtils.toMarkerIcon(requireContext(), R.drawable.ic_map_pin_restaurant, 42f));
            mapView.getOverlays().add(resMarker);
        }

        // 2. Add Customer/Receiver Marker
        if (GeoUtils.isValidCoordinate(receiverLat, receiverLng)) {
            GeoPoint custPoint = new GeoPoint(receiverLat, receiverLng);
            boundsPoints.add(custPoint);

            Marker custMarker = new Marker(mapView);
            custMarker.setPosition(custPoint);
            custMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
            custMarker.setTitle("Vị trí giao hàng");
            custMarker.setIcon(MapMarkerUtils.toMarkerIcon(requireContext(), R.drawable.ic_map_pin_customer, 42f));
            mapView.getOverlays().add(custMarker);
        }

        // 3. Zoom / Center
        if (!boundsPoints.isEmpty()) {
            if (boundsPoints.size() == 1 || mapView.getWidth() == 0 || mapView.getHeight() == 0) {
                mapView.getController().setCenter(boundsPoints.get(0));
                mapView.getController().setZoom(15.0);
            } else {
                try {
                    BoundingBox bounds = BoundingBox.fromGeoPoints(boundsPoints);
                    mapView.zoomToBoundingBox(bounds.increaseByScale(1.3f), true, 100);
                } catch (Exception ignored) {}
            }
        }

        mapView.invalidate();
    }

    public static class AddressSuggestion {
        public String address;
        public double latitude;
        public double longitude;

        public AddressSuggestion(String address, double latitude, double longitude) {
            this.address = address;
            this.latitude = latitude;
            this.longitude = longitude;
        }
    }

    public static class AddressSuggestionAdapter extends RecyclerView.Adapter<AddressSuggestionAdapter.ViewHolder> {
        
        public interface OnItemClickListener {
            void onItemClick(AddressSuggestion suggestion);
        }

        private final List<AddressSuggestion> list;
        private final OnItemClickListener listener;

        public AddressSuggestionAdapter(List<AddressSuggestion> list, OnItemClickListener listener) {
            this.list = list;
            this.listener = listener;
        }

        @NonNull
        @Override
        public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_address_suggestion, parent, false);
            return new ViewHolder(view);
        }

        @Override
        public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
            AddressSuggestion item = list.get(position);
            holder.textAddress.setText(item.address);
            holder.itemView.setOnClickListener(v -> listener.onItemClick(item));
        }

        @Override
        public int getItemCount() {
            return list.size();
        }

        public static class ViewHolder extends RecyclerView.ViewHolder {
            TextView textAddress;

            public ViewHolder(@NonNull View itemView) {
                super(itemView);
                textAddress = itemView.findViewById(R.id.textSuggestionAddress);
            }
        }
    }
}
