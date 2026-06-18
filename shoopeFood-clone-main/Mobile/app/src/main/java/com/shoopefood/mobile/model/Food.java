package com.shoopefood.mobile.model;

import com.google.gson.annotations.SerializedName;

public class Food {
    public int id;
    public Integer categoryId;
    public String name;
    public double price;
    public boolean isAvailable;
    public int defaultQuantity;
    public int currentQuantity;
    @SerializedName(value = "imageUrl", alternate = {"image_url", "image"})
    public String imageUrl;
}
