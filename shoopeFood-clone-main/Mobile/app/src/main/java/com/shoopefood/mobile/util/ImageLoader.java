package com.shoopefood.mobile.util;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.widget.ImageView;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ImageLoader {
    private static final ExecutorService executor = Executors.newCachedThreadPool();
    private static final Handler handler = new Handler(Looper.getMainLooper());

    public static void loadImage(String urlString, ImageView imageView, int placeholderResId) {
        imageView.setImageResource(placeholderResId);
        if (urlString == null || urlString.trim().isEmpty()) {
            return;
        }

        imageView.setTag(urlString);

        executor.submit(() -> {
            try {
                URL url = new URL(urlString);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                conn.connect();
                if (conn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                    InputStream in = conn.getInputStream();
                    Bitmap bitmap = BitmapFactory.decodeStream(in);
                    handler.post(() -> {
                        if (urlString.equals(imageView.getTag())) {
                            imageView.setImageBitmap(bitmap);
                        }
                    });
                }
            } catch (Exception e) {
                // Keep placeholder on failure
            }
        });
    }
}
