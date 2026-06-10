package com.shoopefood.mobile.ui;

import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.shoopefood.mobile.R;
import com.shoopefood.mobile.model.Order;
import com.shoopefood.mobile.model.OrderResponse;
import com.shoopefood.mobile.model.OrderTracking;
import com.shoopefood.mobile.model.OrderTrackingResponse;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;
import com.shoopefood.mobile.util.CurrencyUtils;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class OrderDetailActivity extends AppCompatActivity {

    public static final String EXTRA_ORDER_ID = "order_id";

    private ApiService apiService;
    private ProgressBar progressBar;
    private TextView codeText;
    private TextView statusText;
    private TextView addressText;
    private TextView totalText;
    private TextView itemsText;
    private TextView trackingText;

    private int orderId;

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

        loadOrder();
        loadTracking();
    }

    @Override
    public boolean onSupportNavigateUp() {
        finish();
        return true;
    }

    private void loadOrder() {
        progressBar.setVisibility(View.VISIBLE);

        apiService.getOrderById(orderId).enqueue(new Callback<OrderResponse>() {
            @Override
            public void onResponse(Call<OrderResponse> call, Response<OrderResponse> response) {
                progressBar.setVisibility(View.GONE);

                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    Toast.makeText(OrderDetailActivity.this, ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                    return;
                }

                bindOrder(response.body().data);
            }

            @Override
            public void onFailure(Call<OrderResponse> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(OrderDetailActivity.this, R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void loadTracking() {
        apiService.getOrderTracking(orderId).enqueue(new Callback<OrderTrackingResponse>() {
            @Override
            public void onResponse(Call<OrderTrackingResponse> call, Response<OrderTrackingResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    return;
                }

                OrderTracking tracking = response.body().data;
                String restaurantName = tracking.restaurant != null ? tracking.restaurant.name : "N/A";
                trackingText.setText(getString(
                        R.string.tracking_info,
                        restaurantName,
                        tracking.order != null && tracking.order.statusLabel != null
                                ? tracking.order.statusLabel
                                : tracking.order.statusCode
                ));
            }

            @Override
            public void onFailure(Call<OrderTrackingResponse> call, Throwable t) {
                // Tracking is optional on detail screen.
            }
        });
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
    }
}
