package com.shoopefood.mobile.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.shoopefood.mobile.R;
import com.shoopefood.mobile.model.Restaurant;
import com.shoopefood.mobile.util.ImageUrlUtils;

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

        private final ImageView restaurantImage;
        private final TextView nameText;
        private final TextView addressText;
        private final TextView metaText;
        private final TextView statusText;
        private final TextView promotionText;

        RestaurantViewHolder(@NonNull View itemView) {
            super(itemView);
            restaurantImage = itemView.findViewById(R.id.imageRestaurant);
            nameText = itemView.findViewById(R.id.textRestaurantName);
            addressText = itemView.findViewById(R.id.textRestaurantAddress);
            metaText = itemView.findViewById(R.id.textRestaurantMeta);
            statusText = itemView.findViewById(R.id.textRestaurantStatus);
            promotionText = itemView.findViewById(R.id.textRestaurantPromotion);
        }

        void bind(Restaurant restaurant) {
            nameText.setText(restaurant.name);
            addressText.setText(restaurant.address);
            metaText.setText(String.format(
                    Locale.getDefault(),
                    "\u2B50 %.1f \u2022 %s - %s",
                    restaurant.ratingAvg,
                    formatTime(restaurant.openingTime),
                    formatTime(restaurant.closingTime)
            ));

            boolean isOpen = restaurant.isOpen && restaurant.isOpenToday;
            statusText.setText(isOpen ? R.string.restaurant_open_badge : R.string.restaurant_closed_badge);
            statusText.setTextColor(ContextCompat.getColor(
                    itemView.getContext(),
                    isOpen ? R.color.brand_green_dark : R.color.text_secondary
            ));
            statusText.setBackgroundResource(
                    isOpen ? R.drawable.bg_restaurant_status_open : R.drawable.bg_restaurant_status_closed
            );

            if (restaurant.promotionText != null && !restaurant.promotionText.trim().isEmpty()) {
                promotionText.setVisibility(View.VISIBLE);
                promotionText.setText("\uD83D\uDD25 " + restaurant.promotionText.trim());
            } else {
                promotionText.setVisibility(View.GONE);
            }

            String imageUrl = restaurant.avatarUrl != null && !restaurant.avatarUrl.trim().isEmpty()
                    ? restaurant.avatarUrl
                    : restaurant.imageUrl;
            Glide.with(itemView.getContext())
                    .load(ImageUrlUtils.resolve(imageUrl))
                    .placeholder(R.drawable.ic_app_logo)
                    .error(R.drawable.ic_app_logo)
                    .centerCrop()
                    .into(restaurantImage);

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
