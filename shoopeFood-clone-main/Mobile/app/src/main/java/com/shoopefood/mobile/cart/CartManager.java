package com.shoopefood.mobile.cart;

import com.shoopefood.mobile.model.Food;
import com.shoopefood.mobile.util.GeoUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class CartManager {

    private static CartManager instance;

    private int restaurantId = -1;
    private String restaurantName = "";
    private double restaurantLatitude;
    private double restaurantLongitude;
    private final Map<Integer, CartLine> lines = new LinkedHashMap<>();

    private CartManager() {
    }

    public static synchronized CartManager getInstance() {
        if (instance == null) {
            instance = new CartManager();
        }
        return instance;
    }

    public void setRestaurant(int restaurantId, String restaurantName) {
        setRestaurant(restaurantId, restaurantName, 0, 0);
    }

    public void setRestaurant(int restaurantId, String restaurantName, double latitude, double longitude) {
        if (this.restaurantId != restaurantId) {
            lines.clear();
            this.restaurantLatitude = latitude;
            this.restaurantLongitude = longitude;
        } else if (GeoUtils.isValidCoordinate(latitude, longitude)) {
            this.restaurantLatitude = latitude;
            this.restaurantLongitude = longitude;
        }
        this.restaurantId = restaurantId;
        this.restaurantName = restaurantName;
    }

    public int getRestaurantId() {
        return restaurantId;
    }

    public String getRestaurantName() {
        return restaurantName;
    }

    public double getRestaurantLatitude() {
        return restaurantLatitude;
    }

    public double getRestaurantLongitude() {
        return restaurantLongitude;
    }

    public boolean hasRestaurantCoordinates() {
        return GeoUtils.isValidCoordinate(restaurantLatitude, restaurantLongitude);
    }

    public void addFood(Food food) {
        CartLine line = lines.get(food.id);
        if (line == null) {
            lines.put(food.id, new CartLine(food, 1));
        } else {
            line.quantity += 1;
        }
    }

    public void updateQuantity(int foodId, int quantity) {
        CartLine line = lines.get(foodId);
        if (line == null) {
            return;
        }

        if (quantity <= 0) {
            lines.remove(foodId);
        } else {
            line.quantity = quantity;
        }
    }

    public List<CartLine> getLines() {
        return new ArrayList<>(lines.values());
    }

    public int getTotalItems() {
        int total = 0;
        for (CartLine line : lines.values()) {
            total += line.quantity;
        }
        return total;
    }

    public double getSubtotal() {
        double total = 0;
        for (CartLine line : lines.values()) {
            total += line.food.price * line.quantity;
        }
        return total;
    }

    public void clear() {
        restaurantId = -1;
        restaurantName = "";
        restaurantLatitude = 0;
        restaurantLongitude = 0;
        lines.clear();
    }

    public boolean isEmpty() {
        return lines.isEmpty();
    }

    public static class CartLine {
        public final Food food;
        public int quantity;

        public CartLine(Food food, int quantity) {
            this.food = food;
            this.quantity = quantity;
        }
    }
}
