package com.shoopefood.mobile.model;

public class DriverApplicationRequest {
    public String licensePlate;
    public String idCardNumber;
    public String vehicleType;

    public DriverApplicationRequest(String licensePlate, String idCardNumber, String vehicleType) {
        this.licensePlate = licensePlate;
        this.idCardNumber = idCardNumber;
        this.vehicleType = vehicleType;
    }
}
