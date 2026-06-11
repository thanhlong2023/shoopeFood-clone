package com.shoopefood.mobile.model;

public class DriverLocationRequest {
    public double latitude;
    public double longitude;
    public Double heading;
    public Double speedKmh;

    public DriverLocationRequest(double latitude, double longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.heading = 0d;
        this.speedKmh = 0d;
    }
}
