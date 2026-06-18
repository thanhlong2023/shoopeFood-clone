package com.shoopefood.mobile.repository;

import com.shoopefood.mobile.model.Driver;
import com.shoopefood.mobile.model.DriverLocationApiResponse;
import com.shoopefood.mobile.model.DriverLocationData;
import com.shoopefood.mobile.model.DriverLocationRequest;
import com.shoopefood.mobile.util.GeoUtils;
import com.shoopefood.mobile.model.DriverOrderFeedData;
import com.shoopefood.mobile.model.DriverOrderFeedResponse;
import com.shoopefood.mobile.model.DriverResponse;
import com.shoopefood.mobile.model.Order;
import com.shoopefood.mobile.model.OrderResponse;
import com.shoopefood.mobile.model.UpdateOrderStatusRequest;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class DriverRepository {

    public interface FeedCallback {
        void onSuccess(DriverOrderFeedData data);

        void onError(String message);
    }

    public interface DriverCallback {
        void onSuccess(Driver driver);

        void onError(String message);
    }

    public interface LocationCallback {
        void onSuccess(double latitude, double longitude);

        void onError(String message);
    }

    public interface OrderCallback {
        void onSuccess(Order order);

        void onError(String message);
    }

    private final ApiService apiService;

    public DriverRepository(ApiService apiService) {
        this.apiService = apiService;
    }

    public void loadOrderFeed(FeedCallback callback) {
        apiService.getDriverOrderFeed().enqueue(new Callback<DriverOrderFeedResponse>() {
            @Override
            public void onResponse(Call<DriverOrderFeedResponse> call, Response<DriverOrderFeedResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    callback.onError(ApiClient.parseErrorMessage(response.raw()));
                    return;
                }
                callback.onSuccess(response.body().data);
            }

            @Override
            public void onFailure(Call<DriverOrderFeedResponse> call, Throwable t) {
                callback.onError(t.getMessage() != null ? t.getMessage() : "Network error");
            }
        });
    }

    public void getLatestLocation(int driverId, LocationCallback callback) {
        apiService.getDriverLocation(driverId).enqueue(new Callback<DriverLocationApiResponse>() {
            @Override
            public void onResponse(Call<DriverLocationApiResponse> call, Response<DriverLocationApiResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    callback.onError(ApiClient.parseErrorMessage(response.raw()));
                    return;
                }

                DriverLocationData location = response.body().data;
                if (!GeoUtils.isValidCoordinate(location.latitude, location.longitude)) {
                    callback.onError("Chua co vi tri tren he thong");
                    return;
                }
                callback.onSuccess(location.latitude, location.longitude);
            }

            @Override
            public void onFailure(Call<DriverLocationApiResponse> call, Throwable t) {
                callback.onError(t.getMessage() != null ? t.getMessage() : "Network error");
            }
        });
    }

    public void goOnline(int driverId, double latitude, double longitude, DriverCallback callback) {
        DriverLocationRequest locationRequest = new DriverLocationRequest(latitude, longitude);
        apiService.updateDriverLocation(driverId, locationRequest).enqueue(new Callback<com.shoopefood.mobile.model.ApiMessageResponse>() {
            @Override
            public void onResponse(Call<com.shoopefood.mobile.model.ApiMessageResponse> call, Response<com.shoopefood.mobile.model.ApiMessageResponse> response) {
                if (!response.isSuccessful()) {
                    callback.onError(ApiClient.parseErrorMessage(response.raw()));
                    return;
                }
                setOnlineStatus(driverId, true, callback);
            }

            @Override
            public void onFailure(Call<com.shoopefood.mobile.model.ApiMessageResponse> call, Throwable t) {
                callback.onError(t.getMessage() != null ? t.getMessage() : "Network error");
            }
        });
    }

    public void goOffline(int driverId, DriverCallback callback) {
        setOnlineStatus(driverId, false, callback);
    }

    public void updateOrderStatus(int orderId, String statusCode, int expectedVersion, OrderCallback callback) {
        UpdateOrderStatusRequest request = new UpdateOrderStatusRequest(statusCode, expectedVersion);
        apiService.updateOrderStatus(orderId, request).enqueue(new Callback<OrderResponse>() {
            @Override
            public void onResponse(Call<OrderResponse> call, Response<OrderResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    callback.onError(ApiClient.parseErrorMessage(response.raw()));
                    return;
                }
                callback.onSuccess(response.body().data);
            }

            @Override
            public void onFailure(Call<OrderResponse> call, Throwable t) {
                callback.onError(t.getMessage() != null ? t.getMessage() : "Network error");
            }
        });
    }

    public void acceptOrder(int orderId, OrderCallback callback) {
        apiService.acceptOrder(orderId).enqueue(new Callback<OrderResponse>() {
            @Override
            public void onResponse(Call<OrderResponse> call, Response<OrderResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    callback.onError(ApiClient.parseErrorMessage(response.raw()));
                    return;
                }
                callback.onSuccess(response.body().data);
            }

            @Override
            public void onFailure(Call<OrderResponse> call, Throwable t) {
                callback.onError(t.getMessage() != null ? t.getMessage() : "Network error");
            }
        });
    }

    public void pushLocation(int driverId, double latitude, double longitude) {
        pushLocation(driverId, latitude, longitude, null);
    }

    public void pushLocation(int driverId, double latitude, double longitude, Integer orderId) {
        DriverLocationRequest locationRequest = new DriverLocationRequest(latitude, longitude, orderId);
        apiService.updateDriverLocation(driverId, locationRequest).enqueue(new Callback<com.shoopefood.mobile.model.ApiMessageResponse>() {
            @Override
            public void onResponse(Call<com.shoopefood.mobile.model.ApiMessageResponse> call, Response<com.shoopefood.mobile.model.ApiMessageResponse> response) {
                // Best-effort sync while driver is online.
            }

            @Override
            public void onFailure(Call<com.shoopefood.mobile.model.ApiMessageResponse> call, Throwable t) {
                // Ignore transient network errors for background location sync.
            }
        });
    }

    private void setOnlineStatus(int driverId, boolean online, DriverCallback callback) {
        Call<DriverResponse> call = online
                ? apiService.setDriverOnline(driverId)
                : apiService.setDriverOffline(driverId);

        call.enqueue(new Callback<DriverResponse>() {
            @Override
            public void onResponse(Call<DriverResponse> call, Response<DriverResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    callback.onError(ApiClient.parseErrorMessage(response.raw()));
                    return;
                }
                callback.onSuccess(response.body().data);
            }

            @Override
            public void onFailure(Call<DriverResponse> call, Throwable t) {
                callback.onError(t.getMessage() != null ? t.getMessage() : "Network error");
            }
        });
    }
}
