package com.shoopefood.mobile.util;

import com.shoopefood.mobile.BuildConfig;

public final class ImageUrlUtils {

    private ImageUrlUtils() {
    }

    public static String resolve(String url) {
        if (url == null) {
            return null;
        }

        String value = url.trim();
        if (value.isEmpty()) {
            return null;
        }

        if (value.startsWith("http://") || value.startsWith("https://")) {
            return value
                    .replace("http://localhost:", "http://10.0.2.2:")
                    .replace("http://127.0.0.1:", "http://10.0.2.2:");
        }

        String baseUrl = BuildConfig.API_BASE_URL;
        if (!baseUrl.endsWith("/")) {
            baseUrl += "/";
        }

        while (value.startsWith("/")) {
            value = value.substring(1);
        }

        return baseUrl + value;
    }
}
