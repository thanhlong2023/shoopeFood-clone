package com.shoopefood.mobile.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageButton;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.shoopefood.mobile.R;
import com.shoopefood.mobile.model.Food;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MerchantQuickInventoryAdapter extends RecyclerView.Adapter<MerchantQuickInventoryAdapter.ViewHolder> {

    private final List<Food> foods = new ArrayList<>();
    private final Listener listener;

    public interface Listener {
        void onUpdateQuantity(Food food, int newQuantity);
    }

    public MerchantQuickInventoryAdapter(Listener listener) {
        this.listener = listener;
    }

    public void setFoods(List<Food> newFoods) {
        foods.clear();
        if (newFoods != null) {
            foods.addAll(newFoods);
        }
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_quick_inventory_food, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Food food = foods.get(position);
        holder.bind(food);
    }

    @Override
    public int getItemCount() {
        return foods.size();
    }

    class ViewHolder extends RecyclerView.ViewHolder {
        TextView textName;
        TextView textPrice;
        TextView textQuantity;
        ImageButton btnDecrease;
        ImageButton btnIncrease;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            textName = itemView.findViewById(R.id.textFoodName);
            textPrice = itemView.findViewById(R.id.textFoodPrice);
            textQuantity = itemView.findViewById(R.id.textCurrentQuantity);
            btnDecrease = itemView.findViewById(R.id.btnDecreaseQuantity);
            btnIncrease = itemView.findViewById(R.id.btnIncreaseQuantity);
        }

        void bind(Food food) {
            textName.setText(food.name != null ? food.name : "Món ăn");
            textPrice.setText(String.format(Locale.getDefault(), "%,.0f đ", food.price));
            
            int currentQty = food.currentQuantity;
            textQuantity.setText(String.valueOf(currentQty));

            btnDecrease.setOnClickListener(v -> {
                int qty = food.currentQuantity;
                if (qty > 0) {
                    listener.onUpdateQuantity(food, qty - 1);
                }
            });

            btnIncrease.setOnClickListener(v -> {
                int qty = food.currentQuantity;
                listener.onUpdateQuantity(food, qty + 1);
            });
        }
    }
}
