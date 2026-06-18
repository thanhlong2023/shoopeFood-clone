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
                android.util.Log.d("ApiClient", "authInterceptor - Token retrieved: " + token);
                if (token != null && !token.isEmpty()) {
                    android.util.Log.d("ApiClient", "authInterceptor - Adding Authorization header: Bearer " + token);
                    builder.addHeader("Authorization", "Bearer " + token);
                } else {
                    android.util.Log.w("ApiClient", "authInterceptor - Token is null or empty!");
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
                    .addInterceptor(chain -> {
                        Response response = chain.proceed(chain.request());
                        if (response.code() == 401) {
                            if (sessionManager.isLoggedIn()) {
                                android.util.Log.e("ApiClient", "Received 401 Unauthorized - clearing session and redirecting to LoginActivity");
                                sessionManager.clear();
                                android.content.Intent intent = new android.content.Intent(context, com.shoopefood.mobile.ui.LoginActivity.class);
                                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK | android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK);
                                context.startActivity(intent);
                            }
                        }
                        return response;
                    })
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
        if (response == null) {
            return "Khong the ket noi server";
        }

        try {
            if (response.body() != null) {
                String bodyString = response.body().string();
                ApiError error = new Gson().fromJson(bodyString, ApiError.class);
                if (error != null && error.message != null && !error.message.isEmpty()) {
                    return error.message;
                }
            }
        } catch (Exception ignored) {
            // Ignore IllegalStateException from converted body, IOException, etc.
        }

        return "Loi " + response.code();
    }

    public static String parseErrorMessage(retrofit2.Response<?> response) {
        if (response == null) {
            return "Khong the ket noi server";
        }

        // Try getting message from successful response body (if reflection works)
        if (response.isSuccessful() && response.body() != null) {
            try {
                java.lang.reflect.Field field = response.body().getClass().getField("message");
                Object msg = field.get(response.body());
                if (msg instanceof String && !((String) msg).isEmpty()) {
                    return (String) msg;
                }
            } catch (Exception ignored) {
            }
        }

        // Try parsing errorBody
        if (response.errorBody() != null) {
            try {
                String errorStr = response.errorBody().string();
                ApiError error = new Gson().fromJson(errorStr, ApiError.class);
                if (error != null && error.message != null && !error.message.isEmpty()) {
                    return error.message;
                }
            } catch (Exception ignored) {
            }
        }

        return "Loi " + response.code();
    }
}
