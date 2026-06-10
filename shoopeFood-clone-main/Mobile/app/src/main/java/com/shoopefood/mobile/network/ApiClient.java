package com.shoopefood.mobile.network;

import android.content.Context;

import com.google.gson.Gson;
import com.shoopefood.mobile.BuildConfig;
import com.shoopefood.mobile.model.ApiError;
import com.shoopefood.mobile.session.SessionManager;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

import okhttp3.Interceptor;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public final class ApiClient {

    private static ApiService apiService;

    private ApiClient() {
    }

    public static synchronized ApiService getService(Context context) {
        if (apiService == null) {
            SessionManager sessionManager = new SessionManager(context.getApplicationContext());

            Interceptor authInterceptor = chain -> {
                Request.Builder builder = chain.request().newBuilder()
                        .addHeader("Content-Type", "application/json");

                String token = sessionManager.getToken();
                if (token != null && !token.isEmpty()) {
                    builder.addHeader("Authorization", "Bearer " + token);
                }

                return chain.proceed(builder.build());
            };

            HttpLoggingInterceptor loggingInterceptor = new HttpLoggingInterceptor();
            loggingInterceptor.setLevel(HttpLoggingInterceptor.Level.BODY);

            OkHttpClient client = new OkHttpClient.Builder()
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .readTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(30, TimeUnit.SECONDS)
                    .addInterceptor(authInterceptor)
                    .addInterceptor(loggingInterceptor)
                    .build();

            Retrofit retrofit = new Retrofit.Builder()
                    .baseUrl(BuildConfig.API_BASE_URL)
                    .client(client)
                    .addConverterFactory(GsonConverterFactory.create(new Gson()))
                    .build();

            apiService = retrofit.create(ApiService.class);
        }

        return apiService;
    }

    public static String parseErrorMessage(Response response) {
        if (response == null || response.errorBody() == null) {
            return "Khong the ket noi server";
        }

        try {
            ApiError error = new Gson().fromJson(response.errorBody().string(), ApiError.class);
            if (error != null && error.message != null && !error.message.isEmpty()) {
                return error.message;
            }
        } catch (IOException ignored) {
            // Fall back to default message.
        }

        return "Loi " + response.code();
    }
}
