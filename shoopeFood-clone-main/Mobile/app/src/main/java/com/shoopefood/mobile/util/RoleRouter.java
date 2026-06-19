package com.shoopefood.mobile.util;

import android.content.Context;
import android.content.Intent;

import com.shoopefood.mobile.ui.DriverHomeActivity;
import com.shoopefood.mobile.ui.HomeActivity;
import com.shoopefood.mobile.ui.MerchantHomeActivity;

public final class RoleRouter {

    public static final String ROLE_CUSTOMER = "CUSTOMER";
    public static final String ROLE_MERCHANT = "MERCHANT";
    public static final String ROLE_DRIVER = "DRIVER";
    public static final String ROLE_ADMIN = "ADMIN";

    private RoleRouter() {
    }

    public static Intent getHomeIntent(Context context, String role) {
        if (ROLE_MERCHANT.equals(role)) {
            return new Intent(context, MerchantHomeActivity.class);
        }
        if (ROLE_DRIVER.equals(role)) {
            return new Intent(context, DriverHomeActivity.class);
        }
        return new Intent(context, HomeActivity.class);
    }

    public static boolean isBlockedOnMobile(String role) {
        return ROLE_ADMIN.equals(role);
    }

    public static String getBlockedMessage(String role) {
        if (ROLE_ADMIN.equals(role)) {
            return "Tài khoản Admin chỉ được sử dụng trên web.";
        }
        return "Vai trò này chưa hỗ trợ trên mobile.";
    }
}
