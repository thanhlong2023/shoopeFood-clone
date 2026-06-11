package com.shoopefood.mobile.ui;

import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.android.material.textfield.TextInputEditText;
import com.shoopefood.mobile.R;
import com.shoopefood.mobile.adapter.RestaurantAdapter;
import com.shoopefood.mobile.cart.CartManager;
import com.shoopefood.mobile.model.Restaurant;
import com.shoopefood.mobile.model.RestaurantsResponse;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;
import com.shoopefood.mobile.session.SessionManager;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CustomerHomeFragment extends Fragment implements RestaurantAdapter.OnRestaurantClickListener {

    private ApiService apiService;
    private SessionManager sessionManager;
    private CustomerHomeHost host;
    private RestaurantAdapter adapter;
    private SwipeRefreshLayout swipeRefreshLayout;
    private ProgressBar progressBar;
    private TextView emptyText;
    private TextView welcomeText;
    private TextInputEditText searchInput;
    private FloatingActionButton cartFab;
    private final List<Restaurant> allRestaurants = new ArrayList<>();

    @Override
    public void onAttach(@NonNull android.content.Context context) {
        super.onAttach(context);
        if (!(context instanceof CustomerHomeHost)) {
            throw new IllegalStateException("Host must implement CustomerHomeHost");
        }
        host = (CustomerHomeHost) context;
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_customer_home, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        apiService = ApiClient.getService(requireContext());
        sessionManager = new SessionManager(requireContext());

        RecyclerView recyclerView = view.findViewById(R.id.recyclerRestaurants);
        swipeRefreshLayout = view.findViewById(R.id.swipeRefreshCustomerHome);
        progressBar = view.findViewById(R.id.progressCustomerHome);
        emptyText = view.findViewById(R.id.textEmptyRestaurants);
        welcomeText = view.findViewById(R.id.textCustomerWelcome);
        searchInput = view.findViewById(R.id.inputSearchRestaurants);
        cartFab = view.findViewById(R.id.fabCart);

        if (sessionManager.getUser() != null) {
            welcomeText.setText(getString(R.string.customer_home_welcome, sessionManager.getUser().fullName));
        }

        adapter = new RestaurantAdapter(this);
        recyclerView.setLayoutManager(new LinearLayoutManager(requireContext()));
        recyclerView.setAdapter(adapter);

        swipeRefreshLayout.setColorSchemeResources(R.color.brand_green);
        swipeRefreshLayout.setOnRefreshListener(this::loadRestaurants);
        cartFab.setOnClickListener(v -> host.showCartTab());

        searchInput.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                applySearchFilter(s == null ? "" : s.toString());
            }

            @Override
            public void afterTextChanged(Editable s) {
            }
        });

        loadRestaurants();
    }

    @Override
    public void onResume() {
        super.onResume();
        updateCartBadge();
    }

    private void loadRestaurants() {
        if (!swipeRefreshLayout.isRefreshing()) {
            progressBar.setVisibility(View.VISIBLE);
        }

        apiService.getRestaurants().enqueue(new Callback<RestaurantsResponse>() {
            @Override
            public void onResponse(@NonNull Call<RestaurantsResponse> call, @NonNull Response<RestaurantsResponse> response) {
                progressBar.setVisibility(View.GONE);
                swipeRefreshLayout.setRefreshing(false);

                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    Toast.makeText(requireContext(), ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                    return;
                }

                allRestaurants.clear();
                allRestaurants.addAll(response.body().data);
                applySearchFilter(searchInput.getText() == null ? "" : searchInput.getText().toString());
            }

            @Override
            public void onFailure(@NonNull Call<RestaurantsResponse> call, @NonNull Throwable t) {
                progressBar.setVisibility(View.GONE);
                swipeRefreshLayout.setRefreshing(false);
                Toast.makeText(requireContext(), R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void applySearchFilter(String query) {
        String normalizedQuery = normalizeSearchText(query);
        if (normalizedQuery.isEmpty()) {
            adapter.submitList(new ArrayList<>(allRestaurants));
            updateEmptyState(allRestaurants.isEmpty(), false);
            return;
        }

        List<Restaurant> filtered = new ArrayList<>();
        for (Restaurant restaurant : allRestaurants) {
            if (normalizeSearchText(restaurant.name).contains(normalizedQuery)
                    || normalizeSearchText(restaurant.address).contains(normalizedQuery)) {
                filtered.add(restaurant);
            }
        }
        adapter.submitList(filtered);
        updateEmptyState(filtered.isEmpty(), true);
    }

    private void updateEmptyState(boolean isEmpty, boolean isSearch) {
        if (isEmpty) {
            emptyText.setVisibility(View.VISIBLE);
            emptyText.setText(isSearch ? R.string.customer_no_search_results : R.string.empty_restaurants);
        } else {
            emptyText.setVisibility(View.GONE);
        }
    }

    private String normalizeSearchText(String value) {
        if (value == null) {
            return "";
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd')
                .replace('Đ', 'D')
                .toLowerCase(Locale.US)
                .trim();
        return normalized;
    }

    private void updateCartBadge() {
        int totalItems = CartManager.getInstance().getTotalItems();
        if (cartFab != null) {
            cartFab.setContentDescription(getString(R.string.cart_with_count, totalItems));
        }
    }

    @Override
    public void onRestaurantClick(Restaurant restaurant) {
        Intent intent = new Intent(requireContext(), RestaurantDetailActivity.class);
        intent.putExtra(RestaurantDetailActivity.EXTRA_RESTAURANT_ID, restaurant.id);
        intent.putExtra(RestaurantDetailActivity.EXTRA_RESTAURANT_NAME, restaurant.name);
        startActivity(intent);
    }
}
