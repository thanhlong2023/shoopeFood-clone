package com.shoopefood.mobile.model;

public class RejectOrderRequest {
    public String reason;
    public Integer expectedVersion;

    public RejectOrderRequest(String reason, int expectedVersion) {
        this.reason = reason;
        this.expectedVersion = expectedVersion;
    }
}
