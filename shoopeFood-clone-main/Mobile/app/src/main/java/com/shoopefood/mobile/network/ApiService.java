package com.shoopefood.mobile.network;

import com.shoopefood.mobile.model.CreateOrderRequest;
import com.shoopefood.mobile.model.FoodsResponse;
import com.shoopefood.mobile.model.LoginRequest;
import com.shoopefood.mobile.model.LoginResponse;
import com.shoopefood.mobile.model.MeResponse;
import com.shoopefood.mobile.model.OrderResponse;
import com.shoopefood.mobile.model.OrderTrackingResponse;
import com.shoopefood.mobile.model.OrdersResponse;
import com.shoopefood.mobile.model.RestaurantResponse;
import com.shoopefood.mobile.model.RestaurantsResponse;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface ApiService {

    @POST("api/auth/login")
    Call<LoginResponse> login(@Body LoginRequest request);

    @GET("api/auth/me")
    Call<MeResponse> getCurrentUser();

    @GET("api/restaurants")
    Call<RestaurantsResponse> getRestaurants();

    @GET("api/restaurants/{id}")
    Call<RestaurantResponse> getRestaurantById(@Path("id") int id);

    @GET("api/foods")
    Call<FoodsResponse> getFoods(@Query("restaurantId") int restaurantId);

    @POST("api/orders")
    Call<OrderResponse> createOrder(@Body CreateOrderRequest request);

    @GET("api/orders")
    Call<OrdersResponse> getOrders(@Query("customerId") int customerId);

    @GET("api/orders/{id}")
    Call<OrderResponse> getOrderById(@Path("id") int id);

    @GET("api/orders/{id}/tracking")
    Call<OrderTrackingResponse> getOrderTracking(@Path("id") int id);
}
