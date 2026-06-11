package com.shoopefood.mobile.ui;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.shoopefood.mobile.R;
import com.shoopefood.mobile.adapter.DriverNearbyOrderAdapter;
import com.shoopefood.mobile.databinding.FragmentDriverOrdersListBinding;
import com.shoopefood.mobile.model.Order;
import com.shoopefood.mobile.util.DriverNearbyOrderUtils;
import com.shoopefood.mobile.viewmodel.DriverHomeViewModel;
import com.shoopefood.mobile.viewmodel.DriverHomeViewModelFactory;
import com.shoopefood.mobile.viewmodel.DriverUiState;

import java.util.ArrayList;
import java.util.List;

/**
 * Man hinh danh sach don: tab "Don gan ban" (Nearby Orders) hoac "Dang giao".
 * Danh sach don tai xe (keo de cuon, pull-to-refresh o Activity).
 */
public class DriverOrdersListFragment extends Fragment implements DriverNearbyOrderAdapter.Listener {

    private static final String ARG_MODE = "mode";
    public static final int MODE_NEARBY = 0;
    public static final int MODE_ACTIVE = 1;
    public static final int MODE_COMPLETED = 2;

    private FragmentDriverOrdersListBinding binding;
    private DriverHomeViewModel viewModel;
    private DriverNearbyOrderAdapter adapter;
    private int mode = MODE_NEARBY;

    public static DriverOrdersListFragment newInstance(int mode) {
        DriverOrdersListFragment fragment = new DriverOrdersListFragment();
        Bundle args = new Bundle();
        args.putInt(ARG_MODE, mode);
        fragment.setArguments(args);
        return fragment;
    }

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getArguments() != null) {
            mode = getArguments().getInt(ARG_MODE, MODE_NEARBY);
        }
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        binding = FragmentDriverOrdersListBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        viewModel = new ViewModelProvider(
                requireActivity(),
                new DriverHomeViewModelFactory(requireActivity().getApplication())
        ).get(DriverHomeViewModel.class);

        adapter = new DriverNearbyOrderAdapter(this);
        binding.recyclerOrders.setLayoutManager(new LinearLayoutManager(requireContext()));
        binding.recyclerOrders.setAdapter(adapter);

        viewModel.getUiState().observe(getViewLifecycleOwner(), this::renderState);
    }

    private void renderState(DriverUiState state) {
        if (binding == null || state == null) {
            return;
        }

        boolean isNearbyMode = mode == MODE_NEARBY;
        boolean isCompletedMode = mode == MODE_COMPLETED;
        boolean isOnline = state.driver != null && state.driver.isOnline;
        List<Order> orders;
        if (isNearbyMode) {
            orders = resolveNearbyOrders(state, isOnline);
        } else if (isCompletedMode) {
            orders = state.completedOrders != null ? state.completedOrders : new ArrayList<>();
        } else {
            orders = state.activeOrders;
        }

        boolean allowAcceptOrders = isNearbyMode
                && isOnline
                && (state.activeOrders == null || state.activeOrders.isEmpty())
                && state.activeDeliveryOrderId <= 0
                && !state.simulationRunning;

        adapter.submitList(
                orders,
                state.driverLatitude,
                state.driverLongitude,
                isNearbyMode && isOnline,
                allowAcceptOrders,
                state.acceptingOrderId
        );

        boolean isLoading = state.loading || state.statusUpdating;

        boolean showEmpty = orders.isEmpty() && !isLoading
                && state.acceptingOrderId == DriverUiState.NO_ACCEPTING_ORDER;
        binding.layoutEmpty.setVisibility(showEmpty ? View.VISIBLE : View.GONE);
        binding.recyclerOrders.setVisibility(showEmpty ? View.GONE : View.VISIBLE);

        if (showEmpty) {
            if (isNearbyMode && !isOnline) {
                binding.textEmptyTitle.setText(R.string.driver_nearby_section_title);
                binding.textEmptyHint.setText(R.string.driver_turn_on_to_receive);
            } else if (isNearbyMode) {
                binding.textEmptyTitle.setText(R.string.driver_empty_available);
                binding.textEmptyHint.setText(R.string.driver_nearby_empty_hint);
            } else if (isCompletedMode) {
                binding.textEmptyTitle.setText(R.string.driver_empty_completed);
                binding.textEmptyHint.setText(R.string.driver_completed_empty_hint);
            } else {
                binding.textEmptyTitle.setText(R.string.driver_empty_active);
                binding.textEmptyHint.setText(R.string.driver_active_empty_hint);
            }
        }
    }

    private List<Order> resolveNearbyOrders(DriverUiState state, boolean isOnline) {
        if (!isOnline || state.driverLatitude == null || state.driverLongitude == null) {
            return new ArrayList<>();
        }
        return state.availableOrders != null ? state.availableOrders : new ArrayList<>();
    }

    @Override
    public void onAcceptOrder(Order order) {
        viewModel.acceptOrder(order.id);
    }

    @Override
    public void onOrderClick(Order order) {
        Context context = getContext();
        if (context == null) {
            return;
        }
        Intent intent = new Intent(context, OrderDetailActivity.class);
        intent.putExtra(OrderDetailActivity.EXTRA_ORDER_ID, order.id);
        startActivity(intent);
    }

    @Override
    public void onDestroyView() {
        binding = null;
        super.onDestroyView();
    }
}
