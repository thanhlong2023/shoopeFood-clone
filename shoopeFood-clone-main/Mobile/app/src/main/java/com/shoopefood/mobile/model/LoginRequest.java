package com.shoopefood.mobile.model;

public class LoginRequest {
    public String phone;
    public String password;
    public String role;

    public LoginRequest(String phone, String password, String role) {
        this.phone = phone;
        this.password = password;
        this.role = role;
    }
}
