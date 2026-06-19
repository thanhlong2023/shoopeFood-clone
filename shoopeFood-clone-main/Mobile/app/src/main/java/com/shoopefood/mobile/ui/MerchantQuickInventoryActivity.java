package com.shoopefood.mobile.ui;

import android.os.Bundle;
import android.view.MenuItem;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.shoopefood.mobile.R;
import com.shoopefood.mobile.adapter.MerchantQuickInventoryAdapter;
import com.shoopefood.mobile.model.Food;
import com.shoopefood.mobile.model.FoodPayload;
import com.shoopefood.mobile.model.FoodResponse;
import com.shoopefood.mobile.model.FoodsResponse;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class MerchantQuickInventoryActivity extends AppCompatActivity implements MerchantQuickInventoryAdapter.Listener {

    public static final String EXTRA_RESTAURANT_ID = "restaurant_id";

    private ApiService apiService;
    private MerchantQuickInventoryAdapter adapter;

    private SwipeRefreshLayout swipeRefreshLayout;
    private ProgressBar progressBar;
    private TextView emptyText;

    private int restaurantId = -1;
    private boolean isUpdating = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_merchant_quick_inventory);

        restaurantId = getIntent().getIntExtra(EXTRA_RESTAURANT_ID, -1);
        if (restaurantId == -1) {
            Toast.makeText(this, "Không xác định được cửa hàng", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        apiService = ApiClient.getService(this);

        if (getSupportActionBar() != null) {
            getSupportActionBar().setTitle("Quản lý kho nhanh");
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        }

        swipeRefreshLayout = findViewById(R.id.swipeRefreshQuickInventory);
        progressBar = findViewById(R.id.progressQuickInventory);
        emptyText = findViewById(R.id.textEmptyQuickInventory);

        RecyclerView recyclerView = findViewById(R.id.recyclerQuickInventory);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        adapter = new MerchantQuickInventoryAdapter(this);
        recyclerView.setAdapter(adapter);

        swipeRefreshLayout.setOnRefreshListener(this::loadFoods);

        loadFoods();
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == android.R.id.home) {
            finish();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void loadFoods() {
        if (isUpdating) return;
        if (!swipeRefreshLayout.isRefreshing()) {
            progressBar.setVisibility(View.VISIBLE);
        }

        apiService.getFoods(restaurantId).enqueue(new Callback<FoodsResponse>() {
            @Override
            public void onResponse(Call<FoodsResponse> call, Response<FoodsResponse> response) {
                progressBar.setVisibility(View.GONE);
                swipeRefreshLayout.setRefreshing(false);

                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    Toast.makeText(MerchantQuickInventoryActivity.this, "Lỗi tải danh sách món", Toast.LENGTH_SHORT).show();
                    return;
                }

                adapter.setFoods(response.body().data);
                emptyText.setVisibility(response.body().data.isEmpty() ? View.VISIBLE : View.GONE);
            }

            @Override
            public void onFailure(Call<FoodsResponse> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                swipeRefreshLayout.setRefreshing(false);
                Toast.makeText(MerchantQuickInventoryActivity.this, R.string.network_error, Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onUpdateQuantity(Food food, int newQuantity) {
        if (isUpdating) return;
        isUpdating = true;
        progressBar.setVisibility(View.VISIBLE);

        FoodPayload payload = new FoodPayload(food);
        payload.currentQuantity = newQuantity;

        apiService.updateFood(food.id, payload).enqueue(new Callback<FoodResponse>() {
            @Override
            public void onResponse(Call<FoodResponse> call, Response<FoodResponse> response) {
                isUpdating = false;
                progressBar.setVisibility(View.GONE);
                
                if (response.isSuccessful()) {
                    loadFoods(); // Reload to get fresh data
                } else {
                    Toast.makeText(MerchantQuickInventoryActivity.this, "Cập nhật thất bại", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<FoodResponse> call, Throwable t) {
                isUpdating = false;
                progressBar.setVisibility(View.GONE);
                Toast.makeText(MerchantQuickInventoryActivity.this, R.string.network_error, Toast.LENGTH_SHORT).show();
            }
        });
    }
}
