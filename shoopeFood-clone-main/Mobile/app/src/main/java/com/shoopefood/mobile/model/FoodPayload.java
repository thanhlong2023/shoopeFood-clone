package com.shoopefood.mobile.model;

public class FoodPayload {
    public Integer categoryId;
    public String name;
    public String imageUrl;
    public double price;
    public Boolean isAvailable;
    public Integer defaultQuantity;
    public Integer currentQuantity;

    public FoodPayload() {
    }

    public FoodPayload(Food food) {
        this.categoryId = food.categoryId;
        this.name = food.name;
        this.imageUrl = food.imageUrl;
        this.price = food.price;
        this.isAvailable = food.isAvailable;
        this.defaultQuantity = food.defaultQuantity;
        this.currentQuantity = food.currentQuantity;
    }
}
