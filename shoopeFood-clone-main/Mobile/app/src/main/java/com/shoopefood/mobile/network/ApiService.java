package com.shoopefood.mobile.network;

import com.shoopefood.mobile.model.ApiMessageResponse;
import com.shoopefood.mobile.model.CreateOrderRequest;
import com.shoopefood.mobile.model.DriverLocationApiResponse;
import com.shoopefood.mobile.model.DriverLocationRequest;
import com.shoopefood.mobile.model.DrivingRouteResponse;
import com.shoopefood.mobile.model.DriverOrderFeedResponse;
import com.shoopefood.mobile.model.DriverProfileResponse;
import com.shoopefood.mobile.model.DriverResponse;
import com.shoopefood.mobile.model.FoodsResponse;
import com.shoopefood.mobile.model.LoginRequest;
import com.shoopefood.mobile.model.LoginResponse;
import com.shoopefood.mobile.model.MeResponse;
import com.shoopefood.mobile.model.MerchantApplicationRequest;
import com.shoopefood.mobile.model.OrderResponse;
import com.shoopefood.mobile.model.RejectOrderRequest;
import com.shoopefood.mobile.model.UpdateOrderStatusRequest;
import com.shoopefood.mobile.model.OrderTrackingResponse;
import com.shoopefood.mobile.model.OrdersResponse;
import com.shoopefood.mobile.model.RestaurantResponse;
import com.shoopefood.mobile.model.RestaurantUpdateRequest;
import com.shoopefood.mobile.model.RestaurantUpdateResponse;
import com.shoopefood.mobile.model.RestaurantsResponse;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.PATCH;
import retrofit2.http.POST;
import retrofit2.http.PUT;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface ApiService {

    @POST("api/auth/login")
    Call<LoginResponse> login(@Body LoginRequest request);

    @GET("api/auth/me")
    Call<MeResponse> getCurrentUser();

    @GET("api/restaurants")
    Call<RestaurantsResponse> getRestaurants();

    @GET("api/restaurants/mine")
    Call<RestaurantsResponse> getMyRestaurants();

    @GET("api/restaurants/{id}")
    Call<RestaurantResponse> getRestaurantById(@Path("id") int id);

    @PUT("api/restaurants/{id}")
    Call<RestaurantUpdateResponse> updateRestaurant(@Path("id") int id, @Body RestaurantUpdateRequest request);

    @GET("api/foods")
    Call<FoodsResponse> getFoods(@Query("restaurantId") int restaurantId);

    @POST("api/orders")
    Call<OrderResponse> createOrder(@Body CreateOrderRequest request);

    @GET("api/orders")
    Call<OrdersResponse> getOrders(@Query("customerId") int customerId);

    @GET("api/orders")
    Call<OrdersResponse> getOrdersByDriver(@Query("driverId") int driverId);

    @GET("api/orders")
    Call<OrdersResponse> getMerchantOrders(@Query("restaurantId") Integer restaurantId);

    @PUT("api/orders/{id}/status")
    Call<OrderResponse> updateOrderStatus(@Path("id") int id, @Body UpdateOrderStatusRequest request);

    @PATCH("api/orders/{id}/reject")
    Call<OrderResponse> rejectOrder(@Path("id") int id, @Body RejectOrderRequest request);

    @POST("api/orders/{id}/accept")
    Call<OrderResponse> acceptOrder(@Path("id") int id);

    @GET("api/orders/{id}")
    Call<OrderResponse> getOrderById(@Path("id") int id);

    @GET("api/orders/{id}/tracking")
    Call<OrderTrackingResponse> getOrderTracking(@Path("id") int id);

    @POST("api/applications/merchant")
    Call<ApiMessageResponse> applyMerchant(@Body MerchantApplicationRequest request);

    @GET("api/drivers/me/orders")
    Call<DriverOrderFeedResponse> getDriverOrderFeed();

    @GET("api/drivers/me/route")
    Call<DrivingRouteResponse> getDrivingRoute(
            @Query("fromLat") double fromLat,
            @Query("fromLng") double fromLng,
            @Query("toLat") double toLat,
            @Query("toLng") double toLng
    );

    @GET("api/drivers/{id}/profile")
    Call<DriverProfileResponse> getDriverProfile(@Path("id") int id);

    @GET("api/drivers/{id}/location")
    Call<DriverLocationApiResponse> getDriverLocation(@Path("id") int id);

    @POST("api/drivers/{id}/location")
    Call<ApiMessageResponse> updateDriverLocation(@Path("id") int id, @Body DriverLocationRequest request);

    @PUT("api/drivers/{id}/online/on")
    Call<DriverResponse> setDriverOnline(@Path("id") int id);

    @PUT("api/drivers/{id}/online/off")
    Call<DriverResponse> setDriverOffline(@Path("id") int id);
}
