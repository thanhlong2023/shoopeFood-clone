package com.shoopefood.mobile.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.shoopefood.mobile.R;
import com.shoopefood.mobile.databinding.ItemDriverNearbyOrderBinding;
import com.shoopefood.mobile.model.Order;
import com.shoopefood.mobile.util.CurrencyUtils;
import com.shoopefood.mobile.util.GeoUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

public class DriverNearbyOrderAdapter extends RecyclerView.Adapter<DriverNearbyOrderAdapter.NearbyOrderViewHolder> {

    public interface Listener {
        void onAcceptOrder(Order order);

        void onOrderClick(Order order);
    }

    private final Listener listener;
    private final List<Order> items = new ArrayList<>();
    private Double driverLatitude;
    private Double driverLongitude;
    private boolean showAcceptButton;
    private boolean allowAcceptOrders = true;
    private int acceptingOrderId = -1;

    public DriverNearbyOrderAdapter(Listener listener) {
        this.listener = listener;
    }

    public void submitList(
            List<Order> orders,
            Double driverLatitude,
            Double driverLongitude,
            boolean showAcceptButton,
            boolean allowAcceptOrders,
            int acceptingOrderId
    ) {
        items.clear();
        this.driverLatitude = driverLatitude;
        this.driverLongitude = driverLongitude;
        this.showAcceptButton = showAcceptButton;
        this.allowAcceptOrders = allowAcceptOrders;
        this.acceptingOrderId = acceptingOrderId;

        if (orders != null) {
            items.addAll(orders);
            if (driverLatitude != null && driverLongitude != null) {
                Collections.sort(items, Comparator.comparingDouble(this::distanceForOrder));
            }
        }
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public NearbyOrderViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemDriverNearbyOrderBinding binding = ItemDriverNearbyOrderBinding.inflate(
                LayoutInflater.from(parent.getContext()),
                parent,
                false
        );
        return new NearbyOrderViewHolder(binding);
    }

    @Override
    public void onBindViewHolder(@NonNull NearbyOrderViewHolder holder, int position) {
        holder.bind(items.get(position));
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    private double distanceForOrder(Order order) {
        if (driverLatitude == null || driverLongitude == null || order.restaurant == null) {
            return Double.MAX_VALUE;
        }
        return GeoUtils.distanceKm(
                driverLatitude,
                driverLongitude,
                order.restaurant.latitude,
                order.restaurant.longitude
        );
    }

    class NearbyOrderViewHolder extends RecyclerView.ViewHolder {

        private final ItemDriverNearbyOrderBinding binding;

        NearbyOrderViewHolder(ItemDriverNearbyOrderBinding binding) {
            super(binding.getRoot());
            this.binding = binding;
        }

        void bind(Order order) {
            String restaurantName = order.restaurant != null && order.restaurant.name != null
                    ? order.restaurant.name
                    : binding.getRoot().getContext().getString(R.string.driver_unknown_restaurant, order.restaurantId);
            binding.textRestaurantName.setText(restaurantName);

            String address = order.restaurant != null && order.restaurant.address != null
                    ? order.restaurant.address
                    : order.receiverAddress;
            binding.textRestaurantAddress.setText(address != null && !address.isEmpty()
                    ? address
                    : binding.getRoot().getContext().getString(R.string.driver_unknown_address));

            double distanceKm = distanceForOrder(order);
            if (distanceKm == Double.MAX_VALUE) {
                binding.textOrderDistance.setText(R.string.driver_distance_unknown);
            } else {
                binding.textOrderDistance.setText(
                        binding.getRoot().getContext().getString(R.string.driver_distance_km, distanceKm)
                );
            }

            binding.textOrderTotal.setText(CurrencyUtils.formatVnd(order.totalAmount));
            binding.textOrderCode.setText(order.orderCode != null ? order.orderCode : ("#" + order.id));

            if (showAcceptButton) {
                binding.textOrderStatus.setVisibility(View.GONE);
                binding.buttonAcceptOrder.setVisibility(View.VISIBLE);
                boolean accepting = order.id == acceptingOrderId;
                boolean canAccept = allowAcceptOrders && !accepting;
                binding.buttonAcceptOrder.setEnabled(canAccept);
                binding.buttonAcceptOrder.setText(accepting
                        ? R.string.driver_accepting_order
                        : (allowAcceptOrders
                                ? R.string.driver_accept_order
                                : R.string.driver_accept_blocked_active_order));
                binding.buttonAcceptOrder.setOnClickListener(v -> {
                    if (canAccept) {
                        listener.onAcceptOrder(order);
                    }
                });
            } else {
                binding.buttonAcceptOrder.setVisibility(View.GONE);
                binding.textOrderStatus.setVisibility(View.VISIBLE);
                binding.textOrderStatus.setText(resolveStatusLabel(order));
            }

            binding.getRoot().setOnClickListener(v -> listener.onOrderClick(order));
        }

        private String resolveStatusLabel(Order order) {
            if ("COMPLETED".equals(order.statusCode)) {
                return binding.getRoot().getContext().getString(R.string.driver_order_status_completed);
            }
            if ("DRIVER_ACCEPTED".equals(order.statusCode)) {
                return binding.getRoot().getContext().getString(R.string.driver_order_status_assigned);
            }
            if (order.statusLabel != null && !order.statusLabel.isEmpty()) {
                return order.statusLabel;
            }
            return order.statusCode != null ? order.statusCode : "";
        }
    }
}
