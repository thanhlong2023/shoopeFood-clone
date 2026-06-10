package com.shoopefood.mobile.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
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
import com.shoopefood.mobile.adapter.RestaurantAdapter;
import com.shoopefood.mobile.cart.CartManager;
import com.shoopefood.mobile.model.Restaurant;
import com.shoopefood.mobile.model.RestaurantsResponse;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;
import com.shoopefood.mobile.session.SessionManager;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class HomeActivity extends AppCompatActivity implements RestaurantAdapter.OnRestaurantClickListener {

    private SessionManager sessionManager;
    private ApiService apiService;
    private RestaurantAdapter adapter;
    private SwipeRefreshLayout swipeRefreshLayout;
    private ProgressBar progressBar;
    private TextView emptyText;
    private FloatingActionButton cartFab;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_home);

        sessionManager = new SessionManager(this);
        apiService = ApiClient.getService(this);

        if (!sessionManager.isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        if (getSupportActionBar() != null) {
            getSupportActionBar().setTitle(R.string.home_title);
            getSupportActionBar().setSubtitle(sessionManager.getUser().fullName);
        }

        RecyclerView recyclerView = findViewById(R.id.recyclerRestaurants);
        swipeRefreshLayout = findViewById(R.id.swipeRefresh);
        progressBar = findViewById(R.id.progressHome);
        emptyText = findViewById(R.id.textEmptyRestaurants);
        cartFab = findViewById(R.id.fabCart);

        adapter = new RestaurantAdapter(this);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        recyclerView.setAdapter(adapter);

        swipeRefreshLayout.setOnRefreshListener(this::loadRestaurants);
        cartFab.setOnClickListener(v -> startActivity(new Intent(this, CartActivity.class)));

        loadRestaurants();
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateCartBadge();
    }

    private void loadRestaurants() {
        if (!swipeRefreshLayout.isRefreshing()) {
            progressBar.setVisibility(View.VISIBLE);
        }

        apiService.getRestaurants().enqueue(new Callback<RestaurantsResponse>() {
            @Override
            public void onResponse(Call<RestaurantsResponse> call, Response<RestaurantsResponse> response) {
                progressBar.setVisibility(View.GONE);
                swipeRefreshLayout.setRefreshing(false);

                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    Toast.makeText(HomeActivity.this, ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                    return;
                }

                adapter.submitList(response.body().data);
                emptyText.setVisibility(response.body().data.isEmpty() ? View.VISIBLE : View.GONE);
            }

            @Override
            public void onFailure(Call<RestaurantsResponse> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                swipeRefreshLayout.setRefreshing(false);
                Toast.makeText(HomeActivity.this, R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void updateCartBadge() {
        int totalItems = CartManager.getInstance().getTotalItems();
        cartFab.setContentDescription(getString(R.string.cart_with_count, totalItems));
    }

    @Override
    public void onRestaurantClick(Restaurant restaurant) {
        Intent intent = new Intent(this, RestaurantDetailActivity.class);
        intent.putExtra(RestaurantDetailActivity.EXTRA_RESTAURANT_ID, restaurant.id);
        intent.putExtra(RestaurantDetailActivity.EXTRA_RESTAURANT_NAME, restaurant.name);
        startActivity(intent);
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.menu_home, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        int itemId = item.getItemId();
        if (itemId == R.id.action_orders) {
            startActivity(new Intent(this, OrdersActivity.class));
            return true;
        }
        if (itemId == R.id.action_logout) {
            sessionManager.clear();
            CartManager.getInstance().clear();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }
}
