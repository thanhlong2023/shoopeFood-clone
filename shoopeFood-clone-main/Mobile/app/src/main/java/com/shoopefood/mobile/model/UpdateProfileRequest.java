package com.shoopefood.mobile.model;

public class UpdateProfileRequest {
    public String fullName;
    public String phone;

    public UpdateProfileRequest(String fullName, String phone) {
        this.fullName = fullName;
        this.phone = phone;
    }
}
