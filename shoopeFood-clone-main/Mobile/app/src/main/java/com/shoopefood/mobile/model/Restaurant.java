package com.shoopefood.mobile.model;

import com.google.gson.annotations.SerializedName;

public class Restaurant {
    public int id;
    public int ownerId;
    public String name;
    public String address;
    public String phone;
    public String description;
    public double latitude;
    public double longitude;
    public String openingTime;
    public String closingTime;
    public boolean isOpen;
    public boolean isOpenToday;
    @SerializedName(value = "imageUrl", alternate = {"image_url", "image"})
    public String imageUrl;
    @SerializedName(value = "avatarUrl", alternate = {"avatar_url"})
    public String avatarUrl;
    public String promotionText;
    public String temporaryClosedReason;
    public double ratingAvg;
    public String approvalStatus;
}
