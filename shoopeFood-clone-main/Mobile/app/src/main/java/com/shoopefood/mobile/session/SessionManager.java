package com.shoopefood.mobile.session;

import android.content.Context;
import android.content.SharedPreferences;

import com.google.gson.Gson;
import com.shoopefood.mobile.model.AuthUser;

public class SessionManager {

    private static final String PREFS_NAME = "shoopefood_session";
    private static final String KEY_TOKEN = "token";
    private static final String KEY_USER = "user";

    private final SharedPreferences preferences;
    private final Gson gson = new Gson();

    public SessionManager(Context context) {
        preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public void saveSession(String token, AuthUser user) {
        preferences.edit()
                .putString(KEY_TOKEN, token)
                .putString(KEY_USER, gson.toJson(user))
                .apply();
    }

    public String getToken() {
        return preferences.getString(KEY_TOKEN, null);
    }

    public AuthUser getUser() {
        String json = preferences.getString(KEY_USER, null);
        if (json == null) {
            return null;
        }
        return gson.fromJson(json, AuthUser.class);
    }

    public boolean isLoggedIn() {
        return getToken() != null && getUser() != null;
    }

    public void updateUser(AuthUser user) {
        if (user == null) {
            return;
        }
        preferences.edit().putString(KEY_USER, gson.toJson(user)).apply();
    }

    public void clear() {
        preferences.edit().clear().apply();
    }
}
