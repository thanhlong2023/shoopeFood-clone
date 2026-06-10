package com.shoopefood.mobile.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.shoopefood.mobile.R;
import com.shoopefood.mobile.model.Restaurant;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class RestaurantAdapter extends RecyclerView.Adapter<RestaurantAdapter.RestaurantViewHolder> {

    public interface OnRestaurantClickListener {
        void onRestaurantClick(Restaurant restaurant);
    }

    private final List<Restaurant> items = new ArrayList<>();
    private final OnRestaurantClickListener listener;

    public RestaurantAdapter(OnRestaurantClickListener listener) {
        this.listener = listener;
    }

    public void submitList(List<Restaurant> restaurants) {
        items.clear();
        if (restaurants != null) {
            items.addAll(restaurants);
        }
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public RestaurantViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_restaurant, parent, false);
        return new RestaurantViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull RestaurantViewHolder holder, int position) {
        holder.bind(items.get(position));
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    class RestaurantViewHolder extends RecyclerView.ViewHolder {

        private final TextView nameText;
        private final TextView addressText;
        private final TextView metaText;

        RestaurantViewHolder(@NonNull View itemView) {
            super(itemView);
            nameText = itemView.findViewById(R.id.textRestaurantName);
            addressText = itemView.findViewById(R.id.textRestaurantAddress);
            metaText = itemView.findViewById(R.id.textRestaurantMeta);
        }

        void bind(Restaurant restaurant) {
            nameText.setText(restaurant.name);
            addressText.setText(restaurant.address);
            metaText.setText(String.format(
                    Locale.getDefault(),
                    "%.1f sao | %s - %s | %s",
                    restaurant.ratingAvg,
                    formatTime(restaurant.openingTime),
                    formatTime(restaurant.closingTime),
                    restaurant.isOpenToday ? "Mo cua" : "Dong cua"
            ));

            itemView.setOnClickListener(v -> listener.onRestaurantClick(restaurant));
        }

        private String formatTime(String time) {
            if (time == null || time.length() < 5) {
                return "--:--";
            }
            return time.substring(0, 5);
        }
    }
}
