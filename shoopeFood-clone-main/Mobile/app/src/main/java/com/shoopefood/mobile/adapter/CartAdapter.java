package com.shoopefood.mobile.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.shoopefood.mobile.R;
import com.shoopefood.mobile.cart.CartManager;
import com.shoopefood.mobile.util.CurrencyUtils;

import java.util.ArrayList;
import java.util.List;

public class CartAdapter extends RecyclerView.Adapter<CartAdapter.CartViewHolder> {

    public interface OnCartChangeListener {
        void onCartChanged();
    }

    private final List<CartManager.CartLine> items = new ArrayList<>();
    private final OnCartChangeListener listener;

    public CartAdapter(OnCartChangeListener listener) {
        this.listener = listener;
    }

    public void submitLines(List<CartManager.CartLine> lines) {
        items.clear();
        if (lines != null) {
            items.addAll(lines);
        }
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public CartViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_cart, parent, false);
        return new CartViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull CartViewHolder holder, int position) {
        holder.bind(items.get(position));
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    class CartViewHolder extends RecyclerView.ViewHolder {

        private final TextView nameText;
        private final TextView priceText;
        private final TextView quantityText;
        private final MaterialButton minusButton;
        private final MaterialButton plusButton;

        CartViewHolder(@NonNull View itemView) {
            super(itemView);
            nameText = itemView.findViewById(R.id.textCartFoodName);
            priceText = itemView.findViewById(R.id.textCartFoodPrice);
            quantityText = itemView.findViewById(R.id.textCartQuantity);
            minusButton = itemView.findViewById(R.id.buttonMinus);
            plusButton = itemView.findViewById(R.id.buttonPlus);
        }

        void bind(CartManager.CartLine line) {
            nameText.setText(line.food.name);
            priceText.setText(CurrencyUtils.formatVnd(line.food.price * line.quantity));
            quantityText.setText(String.valueOf(line.quantity));

            minusButton.setOnClickListener(v -> {
                CartManager.getInstance().updateQuantity(line.food.id, line.quantity - 1);
                listener.onCartChanged();
            });

            plusButton.setOnClickListener(v -> {
                CartManager.getInstance().updateQuantity(line.food.id, line.quantity + 1);
                listener.onCartChanged();
            });
        }
    }
}
