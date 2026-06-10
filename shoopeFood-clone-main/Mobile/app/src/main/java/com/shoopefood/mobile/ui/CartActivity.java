package com.shoopefood.mobile.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.shoopefood.mobile.R;
import com.shoopefood.mobile.adapter.CartAdapter;
import com.shoopefood.mobile.cart.CartManager;
import com.shoopefood.mobile.model.CreateOrderRequest;
import com.shoopefood.mobile.model.OrderItemRequest;
import com.shoopefood.mobile.model.OrderResponse;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;
import com.shoopefood.mobile.session.SessionManager;
import com.shoopefood.mobile.util.CurrencyUtils;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CartActivity extends AppCompatActivity implements CartAdapter.OnCartChangeListener {

    private CartManager cartManager;
    private SessionManager sessionManager;
    private ApiService apiService;
    private CartAdapter adapter;
    private TextView restaurantText;
    private TextView subtotalText;
    private TextInputEditText addressInput;
    private TextInputEditText distanceInput;
    private MaterialButton checkoutButton;
    private ProgressBar progressBar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_cart);

        cartManager = CartManager.getInstance();
        sessionManager = new SessionManager(this);
        apiService = ApiClient.getService(this);

        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setTitle(R.string.cart_title);
        }

        restaurantText = findViewById(R.id.textCartRestaurant);
        subtotalText = findViewById(R.id.textCartSubtotal);
        addressInput = findViewById(R.id.inputReceiverAddress);
        distanceInput = findViewById(R.id.inputDistanceKm);
        checkoutButton = findViewById(R.id.buttonCheckout);
        progressBar = findViewById(R.id.progressCart);

        RecyclerView recyclerView = findViewById(R.id.recyclerCart);
        adapter = new CartAdapter(this);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        recyclerView.setAdapter(adapter);

        addressInput.setText("12 Nguyen Hue, Quan 1");
        distanceInput.setText("3.2");

        checkoutButton.setOnClickListener(v -> checkout());

        refreshCartUi();
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
    }

    private void checkout() {
        if (cartManager.isEmpty() || sessionManager.getUser() == null) {
            Toast.makeText(this, R.string.cart_empty, Toast.LENGTH_SHORT).show();
            return;
        }

        String address = addressInput.getText() != null ? addressInput.getText().toString().trim() : "";
        String distanceValue = distanceInput.getText() != null ? distanceInput.getText().toString().trim() : "";

        if (address.isEmpty() || distanceValue.isEmpty()) {
            Toast.makeText(this, R.string.checkout_required, Toast.LENGTH_SHORT).show();
            return;
        }

        double distanceKm;
        try {
            distanceKm = Double.parseDouble(distanceValue);
        } catch (NumberFormatException ex) {
            Toast.makeText(this, R.string.invalid_distance, Toast.LENGTH_SHORT).show();
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
                10.7769,
                106.7009,
                distanceKm,
                "STANDARD",
                items
        );

        setLoading(true);

        apiService.createOrder(request).enqueue(new Callback<OrderResponse>() {
            @Override
            public void onResponse(Call<OrderResponse> call, Response<OrderResponse> response) {
                setLoading(false);

                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    Toast.makeText(CartActivity.this, ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
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
}
