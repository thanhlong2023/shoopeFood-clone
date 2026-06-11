package com.shoopefood.mobile;

import android.app.Application;

import org.osmdroid.config.Configuration;

import java.io.File;

public class ShoopeFoodApplication extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        Configuration.getInstance().setUserAgentValue(BuildConfig.APPLICATION_ID);
        File cacheDir = new File(getCacheDir(), "osmdroid");
        if (!cacheDir.exists()) {
            cacheDir.mkdirs();
        }
        Configuration.getInstance().setOsmdroidBasePath(cacheDir);
        Configuration.getInstance().setOsmdroidTileCache(cacheDir);
    }
}
