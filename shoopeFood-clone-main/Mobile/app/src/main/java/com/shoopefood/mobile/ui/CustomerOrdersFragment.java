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
import com.shoopefood.mobile.adapter.OrderAdapter;
import com.shoopefood.mobile.model.Order;
import com.shoopefood.mobile.model.OrdersResponse;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;
import com.shoopefood.mobile.session.SessionManager;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CustomerOrdersFragment extends Fragment implements OrderAdapter.OnOrderClickListener {

    private ApiService apiService;
    private SessionManager sessionManager;
    private OrderAdapter adapter;
    private SwipeRefreshLayout swipeRefreshLayout;
    private ProgressBar progressBar;
    private TextView emptyText;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_customer_orders, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        apiService = ApiClient.getService(requireContext());
        sessionManager = new SessionManager(requireContext());

        RecyclerView recyclerView = view.findViewById(R.id.recyclerOrders);
        swipeRefreshLayout = view.findViewById(R.id.swipeRefreshCustomerOrders);
        progressBar = view.findViewById(R.id.progressCustomerOrders);
        emptyText = view.findViewById(R.id.textEmptyOrders);

        adapter = new OrderAdapter(this);
        recyclerView.setLayoutManager(new LinearLayoutManager(requireContext()));
        recyclerView.setAdapter(adapter);

        swipeRefreshLayout.setColorSchemeResources(R.color.brand_green);
        swipeRefreshLayout.setOnRefreshListener(this::loadOrders);
        loadOrders();
    }

    public void reloadOrders() {
        if (swipeRefreshLayout != null) {
            loadOrders();
        }
    }

    private void loadOrders() {
        if (sessionManager.getUser() == null) {
            return;
        }

        if (!swipeRefreshLayout.isRefreshing()) {
            progressBar.setVisibility(View.VISIBLE);
        }

        apiService.getOrders(sessionManager.getUser().id).enqueue(new Callback<OrdersResponse>() {
            @Override
            public void onResponse(@NonNull Call<OrdersResponse> call, @NonNull Response<OrdersResponse> response) {
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
            public void onFailure(@NonNull Call<OrdersResponse> call, @NonNull Throwable t) {
                progressBar.setVisibility(View.GONE);
                swipeRefreshLayout.setRefreshing(false);
                Toast.makeText(requireContext(), R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    @Override
    public void onOrderClick(Order order) {
        Intent intent = new Intent(requireContext(), OrderDetailActivity.class);
        intent.putExtra(OrderDetailActivity.EXTRA_ORDER_ID, order.id);
        startActivity(intent);
    }
}
