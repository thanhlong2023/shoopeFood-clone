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
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.shoopefood.mobile.R;
import com.shoopefood.mobile.adapter.FoodAdapter;
import com.shoopefood.mobile.cart.CartManager;
import com.shoopefood.mobile.model.Food;
import com.shoopefood.mobile.model.FoodsResponse;
import com.shoopefood.mobile.model.Restaurant;
import com.shoopefood.mobile.model.RestaurantResponse;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RestaurantDetailActivity extends AppCompatActivity implements FoodAdapter.OnFoodActionListener {

    public static final String EXTRA_RESTAURANT_ID = "restaurant_id";
    public static final String EXTRA_RESTAURANT_NAME = "restaurant_name";

    private ApiService apiService;
    private FoodAdapter adapter;
    private ProgressBar progressBar;
    private TextView addressText;
    private TextView metaText;
    private TextView emptyText;
    private FloatingActionButton cartFab;
    private SwipeRefreshLayout swipeRefreshLayout;

    private int restaurantId;
    private String restaurantName;
    private double restaurantLatitude;
    private double restaurantLongitude;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_restaurant_detail);

        apiService = ApiClient.getService(this);
        restaurantId = getIntent().getIntExtra(EXTRA_RESTAURANT_ID, -1);
        restaurantName = getIntent().getStringExtra(EXTRA_RESTAURANT_NAME);

        if (restaurantId <= 0) {
            finish();
            return;
        }

        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setTitle(restaurantName);
        }

        addressText = findViewById(R.id.textRestaurantAddress);
        metaText = findViewById(R.id.textRestaurantMeta);
        emptyText = findViewById(R.id.textEmptyFoods);
        progressBar = findViewById(R.id.progressRestaurantDetail);
        cartFab = findViewById(R.id.fabCart);
        swipeRefreshLayout = findViewById(R.id.swipeRefreshFoods);
        swipeRefreshLayout.setColorSchemeResources(R.color.brand_green);
        swipeRefreshLayout.setOnRefreshListener(this::refreshFoods);

        RecyclerView recyclerView = findViewById(R.id.recyclerFoods);
        adapter = new FoodAdapter(this);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        recyclerView.setAdapter(adapter);

        cartFab.setOnClickListener(v -> {
            Intent intent = new Intent(this, HomeActivity.class);
            intent.putExtra(HomeActivity.EXTRA_INITIAL_TAB, HomeActivity.TAB_CART);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(intent);
            finish();
        });

        loadRestaurant();
        loadFoods();
    }

    @Override
    public boolean onSupportNavigateUp() {
        finish();
        return true;
    }

    private void loadRestaurant() {
        apiService.getRestaurantById(restaurantId).enqueue(new Callback<RestaurantResponse>() {
            @Override
            public void onResponse(Call<RestaurantResponse> call, Response<RestaurantResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    return;
                }

                Restaurant restaurant = response.body().data;
                restaurantName = restaurant.name;
                restaurantLatitude = restaurant.latitude;
                restaurantLongitude = restaurant.longitude;
                if (getSupportActionBar() != null) {
                    getSupportActionBar().setTitle(restaurant.name);
                }
                addressText.setText(restaurant.address);
                CartManager.getInstance().setRestaurant(
                        restaurant.id,
                        restaurant.name,
                        restaurant.latitude,
                        restaurant.longitude
                );
                metaText.setText(String.format(
                        "%.1f sao | %s",
                        restaurant.ratingAvg,
                        restaurant.isOpenToday ? "Mở cửa hôm nay" : "Đóng cửa hôm nay"
                ));
            }

            @Override
            public void onFailure(Call<RestaurantResponse> call, Throwable t) {
                // Keep header from intent extras.
            }
        });
    }

    private void refreshFoods() {
        loadFoods();
    }

    private void loadFoods() {
        if (swipeRefreshLayout == null || !swipeRefreshLayout.isRefreshing()) {
            progressBar.setVisibility(View.VISIBLE);
        }

        apiService.getFoods(restaurantId).enqueue(new Callback<FoodsResponse>() {
            @Override
            public void onResponse(Call<FoodsResponse> call, Response<FoodsResponse> response) {
                progressBar.setVisibility(View.GONE);
                if (swipeRefreshLayout != null) {
                    swipeRefreshLayout.setRefreshing(false);
                }

                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    Toast.makeText(
                            RestaurantDetailActivity.this,
                            ApiClient.parseErrorMessage(response.raw()),
                            Toast.LENGTH_LONG
                    ).show();
                    return;
                }

                adapter.submitList(response.body().data);
                emptyText.setVisibility(response.body().data.isEmpty() ? View.VISIBLE : View.GONE);
            }

            @Override
            public void onFailure(Call<FoodsResponse> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                if (swipeRefreshLayout != null) {
                    swipeRefreshLayout.setRefreshing(false);
                }
                Toast.makeText(RestaurantDetailActivity.this, R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    @Override
    public void onAddFood(Food food) {
        CartManager cart = CartManager.getInstance();
        cart.setRestaurant(restaurantId, restaurantName, restaurantLatitude, restaurantLongitude);
        cart.addFood(food);
        Toast.makeText(this, R.string.added_to_cart, Toast.LENGTH_SHORT).show();
    }
}
