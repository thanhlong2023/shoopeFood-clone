package com.shoopefood.mobile.model;

public class MerchantApplicationRequest {
    public String name;
    public String address;
    public Double latitude;
    public Double longitude;
    public String openingTime;
    public String closingTime;
    public String imageUrl;

    public MerchantApplicationRequest(
            String name,
            String address,
            double latitude,
            double longitude,
            String openingTime,
            String closingTime,
            String imageUrl
    ) {
        this.name = name;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
        this.openingTime = openingTime;
        this.closingTime = closingTime;
        this.imageUrl = imageUrl;
    }
}
