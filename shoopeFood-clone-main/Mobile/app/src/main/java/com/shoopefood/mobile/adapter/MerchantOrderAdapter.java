package com.shoopefood.mobile.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.shoopefood.mobile.R;
import com.shoopefood.mobile.model.Order;
import com.shoopefood.mobile.model.OrderItem;
import com.shoopefood.mobile.util.CurrencyUtils;
import com.shoopefood.mobile.util.MerchantOrderBuckets;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MerchantOrderAdapter extends RecyclerView.Adapter<MerchantOrderAdapter.MerchantOrderViewHolder> {

    public interface Listener {
        void onConfirm(Order order);

        void onReject(Order order);

        void onMarkReady(Order order);
    }

    private final Listener listener;
    private final Map<Integer, String> restaurantNames = new HashMap<>();
    private final List<Order> items = new ArrayList<>();

    public MerchantOrderAdapter(Listener listener) {
        this.listener = listener;
    }

    public void setRestaurantNames(Map<Integer, String> names) {
        restaurantNames.clear();
        if (names != null) {
            restaurantNames.putAll(names);
        }
    }

    public void submitOrders(List<Order> orders, int tab) {
        items.clear();
        items.addAll(MerchantOrderBuckets.filter(orders, tab));
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public MerchantOrderViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_merchant_order, parent, false);
        return new MerchantOrderViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull MerchantOrderViewHolder holder, int position) {
        holder.bind(items.get(position));
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    class MerchantOrderViewHolder extends RecyclerView.ViewHolder {

        private final TextView codeText;
        private final TextView statusText;
        private final TextView restaurantText;
        private final TextView itemsText;
        private final TextView addressText;
        private final TextView totalText;
        private final TextView timeText;
        private final LinearLayout actionsLayout;
        private final MaterialButton rejectButton;
        private final MaterialButton primaryButton;

        MerchantOrderViewHolder(@NonNull View itemView) {
            super(itemView);
            codeText = itemView.findViewById(R.id.textOrderCode);
            statusText = itemView.findViewById(R.id.textOrderStatus);
            restaurantText = itemView.findViewById(R.id.textRestaurantName);
            itemsText = itemView.findViewById(R.id.textOrderItems);
            addressText = itemView.findViewById(R.id.textOrderAddress);
            totalText = itemView.findViewById(R.id.textOrderTotal);
            timeText = itemView.findViewById(R.id.textOrderTime);
            actionsLayout = itemView.findViewById(R.id.layoutOrderActions);
            rejectButton = itemView.findViewById(R.id.buttonRejectOrder);
            primaryButton = itemView.findViewById(R.id.buttonPrimaryAction);
        }

        void bind(Order order) {
            codeText.setText("#" + order.orderCode);
            bindStatusBadge(order);
            restaurantText.setText(restaurantNames.getOrDefault(order.restaurantId, "Quán #" + order.restaurantId));
            itemsText.setText(buildItemsSummary(order));
            addressText.setText("Giao đến: " + (order.receiverAddress != null ? order.receiverAddress : "-"));
            totalText.setText(CurrencyUtils.formatVnd(order.totalAmount));
            timeText.setText(formatCreatedAt(order.createdAt));
            bindActions(order);
        }

        private void bindStatusBadge(Order order) {
            String label = order.statusLabel != null ? order.statusLabel : order.statusCode;
            statusText.setText(label);

            int backgroundRes;
            int textColor;
            if (MerchantOrderBuckets.belongsToTab(order, MerchantOrderBuckets.TAB_WAITING)) {
                backgroundRes = R.drawable.bg_status_waiting;
                textColor = R.color.status_waiting_text;
            } else if (MerchantOrderBuckets.belongsToTab(order, MerchantOrderBuckets.TAB_COOKING)) {
                backgroundRes = R.drawable.bg_status_cooking;
                textColor = R.color.status_cooking_text;
            } else {
                backgroundRes = R.drawable.bg_status_done;
                textColor = R.color.status_done_text;
            }

            statusText.setBackgroundResource(backgroundRes);
            statusText.setTextColor(ContextCompat.getColor(itemView.getContext(), textColor));
        }

        private void bindActions(Order order) {
            boolean showActions = false;
            rejectButton.setVisibility(View.GONE);
            primaryButton.setVisibility(View.GONE);

            if (MerchantOrderBuckets.canConfirm(order.statusCode)) {
                showActions = true;
                primaryButton.setVisibility(View.VISIBLE);
                primaryButton.setText(R.string.merchant_confirm_order);
                primaryButton.setOnClickListener(v -> listener.onConfirm(order));

                if (MerchantOrderBuckets.canReject(order.statusCode)) {
                    rejectButton.setVisibility(View.VISIBLE);
                    rejectButton.setOnClickListener(v -> listener.onReject(order));
                }
            } else if (MerchantOrderBuckets.canMarkReady(order.statusCode)) {
                showActions = true;
                primaryButton.setVisibility(View.VISIBLE);
                primaryButton.setText(R.string.merchant_mark_ready);
                primaryButton.setOnClickListener(v -> listener.onMarkReady(order));
            }

            actionsLayout.setVisibility(showActions ? View.VISIBLE : View.GONE);
        }

        private String buildItemsSummary(Order order) {
            if (order.items == null || order.items.isEmpty()) {
                return "Không có món trong đơn";
            }
            StringBuilder builder = new StringBuilder();
            for (int i = 0; i < order.items.size(); i++) {
                OrderItem item = order.items.get(i);
                if (i > 0) {
                    builder.append("\n");
                }
                String name = item.foodName != null ? item.foodName : "Món #" + item.foodId;
                builder.append(item.quantity).append(" x ").append(name);
            }
            return builder.toString();
        }

        private String formatCreatedAt(String createdAt) {
            if (createdAt == null || createdAt.isEmpty()) {
                return "";
            }
            if (createdAt.length() >= 16) {
                return createdAt.substring(11, 16);
            }
            return createdAt;
        }
    }
}
