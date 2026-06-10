package com.shoopefood.mobile.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.shoopefood.mobile.R;
import com.shoopefood.mobile.model.Order;
import com.shoopefood.mobile.util.CurrencyUtils;

import java.util.ArrayList;
import java.util.List;

public class OrderAdapter extends RecyclerView.Adapter<OrderAdapter.OrderViewHolder> {

    public interface OnOrderClickListener {
        void onOrderClick(Order order);
    }

    private final List<Order> items = new ArrayList<>();
    private final OnOrderClickListener listener;

    public OrderAdapter(OnOrderClickListener listener) {
        this.listener = listener;
    }

    public void submitList(List<Order> orders) {
        items.clear();
        if (orders != null) {
            items.addAll(orders);
        }
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public OrderViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_order, parent, false);
        return new OrderViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull OrderViewHolder holder, int position) {
        holder.bind(items.get(position));
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    class OrderViewHolder extends RecyclerView.ViewHolder {

        private final TextView codeText;
        private final TextView statusText;
        private final TextView totalText;

        OrderViewHolder(@NonNull View itemView) {
            super(itemView);
            codeText = itemView.findViewById(R.id.textOrderCode);
            statusText = itemView.findViewById(R.id.textOrderStatus);
            totalText = itemView.findViewById(R.id.textOrderTotal);
        }

        void bind(Order order) {
            codeText.setText(order.orderCode);
            statusText.setText(order.statusLabel != null ? order.statusLabel : order.statusCode);
            totalText.setText(CurrencyUtils.formatVnd(order.totalAmount));
            itemView.setOnClickListener(v -> listener.onOrderClick(order));
        }
    }
}
