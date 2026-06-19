package com.shoopefood.mobile.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.shoopefood.mobile.R;
import com.shoopefood.mobile.model.Food;
import com.shoopefood.mobile.util.CurrencyUtils;
import com.shoopefood.mobile.util.ImageLoader;

import java.util.ArrayList;
import java.util.List;

public class FoodAdapter extends RecyclerView.Adapter<FoodAdapter.FoodViewHolder> {

    public interface OnFoodActionListener {
        void onAddFood(Food food);
    }

    private final List<Food> items = new ArrayList<>();
    private final OnFoodActionListener listener;

    public FoodAdapter(OnFoodActionListener listener) {
        this.listener = listener;
    }

    public void submitList(List<Food> foods) {
        items.clear();
        if (foods != null) {
            items.addAll(foods);
        }
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public FoodViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_food, parent, false);
        return new FoodViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull FoodViewHolder holder, int position) {
        holder.bind(items.get(position));
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    class FoodViewHolder extends RecyclerView.ViewHolder {

        private final ImageView foodImage;
        private final TextView nameText;
        private final TextView priceText;
        private final TextView statusText;
        private final MaterialButton addButton;

        FoodViewHolder(@NonNull View itemView) {
            super(itemView);
            foodImage = itemView.findViewById(R.id.imageFood);
            nameText = itemView.findViewById(R.id.textFoodName);
            priceText = itemView.findViewById(R.id.textFoodPrice);
            statusText = itemView.findViewById(R.id.textFoodStatus);
            addButton = itemView.findViewById(R.id.buttonAddFood);
        }

        void bind(Food food) {
            nameText.setText(food.name);
            priceText.setText(CurrencyUtils.formatVnd(food.price));
            statusText.setText(food.isAvailable ? "Còn hàng" : "Hết hàng");
            addButton.setEnabled(food.isAvailable);
            addButton.setOnClickListener(v -> listener.onAddFood(food));
            
            // Format URL to relative to absolute if needed, otherwise load directly
            String imgUrl = food.imageUrl;
            if (imgUrl != null && imgUrl.startsWith("uploads/")) {
                // Point to backend API url host
                imgUrl = "http://10.0.2.2:3000/" + imgUrl;
            }
            ImageLoader.loadImage(imgUrl, foodImage, R.drawable.ic_app_logo);
        }
    }
}
