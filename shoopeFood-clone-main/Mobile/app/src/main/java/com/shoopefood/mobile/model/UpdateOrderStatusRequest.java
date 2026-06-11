package com.shoopefood.mobile.model;

public class UpdateOrderStatusRequest {
    public String statusCode;
    public Integer expectedVersion;

    public UpdateOrderStatusRequest(String statusCode, int expectedVersion) {
        this.statusCode = statusCode;
        this.expectedVersion = expectedVersion;
    }
}
