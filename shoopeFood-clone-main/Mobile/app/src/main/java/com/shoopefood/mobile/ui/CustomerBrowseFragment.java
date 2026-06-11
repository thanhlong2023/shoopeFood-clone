package com.shoopefood.mobile.ui;

import android.content.Intent;
import android.os.Bundle;
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

import com.shoopefood.mobile.R;
import com.shoopefood.mobile.adapter.RestaurantAdapter;
import com.shoopefood.mobile.model.Restaurant;
import com.shoopefood.mobile.model.RestaurantsResponse;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CustomerBrowseFragment extends Fragment implements RestaurantAdapter.OnRestaurantClickListener {

    private ApiService apiService;
    private RestaurantAdapter adapter;
    private SwipeRefreshLayout swipeRefreshLayout;
    private ProgressBar progressBar;
    private TextView emptyText;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_customer_browse, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        apiService = ApiClient.getService(requireContext());

        swipeRefreshLayout = view.findViewById(R.id.swipeRefreshBrowse);
        progressBar = view.findViewById(R.id.progressBrowse);
        emptyText = view.findViewById(R.id.textEmptyRestaurants);
        RecyclerView recyclerView = view.findViewById(R.id.recyclerRestaurants);

        adapter = new RestaurantAdapter(this);
        recyclerView.setLayoutManager(new LinearLayoutManager(requireContext()));
        recyclerView.setAdapter(adapter);

        swipeRefreshLayout.setColorSchemeResources(R.color.brand_green);
        swipeRefreshLayout.setOnRefreshListener(this::loadRestaurants);
        loadRestaurants();
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

                adapter.submitList(response.body().data);
                emptyText.setVisibility(response.body().data.isEmpty() ? View.VISIBLE : View.GONE);
            }

            @Override
            public void onFailure(@NonNull Call<RestaurantsResponse> call, @NonNull Throwable t) {
                progressBar.setVisibility(View.GONE);
                swipeRefreshLayout.setRefreshing(false);
                Toast.makeText(requireContext(), R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    @Override
    public void onRestaurantClick(Restaurant restaurant) {
        Intent intent = new Intent(requireContext(), RestaurantDetailActivity.class);
        intent.putExtra(RestaurantDetailActivity.EXTRA_RESTAURANT_ID, restaurant.id);
        intent.putExtra(RestaurantDetailActivity.EXTRA_RESTAURANT_NAME, restaurant.name);
        startActivity(intent);
    }
}
