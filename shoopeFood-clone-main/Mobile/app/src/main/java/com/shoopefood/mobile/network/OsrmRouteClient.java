package com.shoopefood.mobile.network;

import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;
import com.shoopefood.mobile.model.DrivingRouteData;
import com.shoopefood.mobile.model.DrivingRouteResponse;
import com.shoopefood.mobile.model.RoutePoint;
import com.shoopefood.mobile.util.GeoRouteUtils;

import android.os.Handler;
import android.os.Looper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import retrofit2.Call;
import retrofit2.Callback;

public class OsrmRouteClient {

    public interface RouteCallback {
        void onSuccess(List<RoutePoint> points);

        void onError(String message);
    }

    private static final String OSRM_BASE = "https://router.project-osrm.org";

    private final ApiService apiService;
    private final OkHttpClient httpClient = new OkHttpClient();
    private final Gson gson = new Gson();
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public OsrmRouteClient(ApiService apiService) {
        this.apiService = apiService;
    }

    public void fetchDrivingRoute(
            double fromLat,
            double fromLng,
            double toLat,
            double toLng,
            RouteCallback callback
    ) {
        apiService.getDrivingRoute(fromLat, fromLng, toLat, toLng).enqueue(new Callback<DrivingRouteResponse>() {
            @Override
            public void onResponse(Call<DrivingRouteResponse> call, retrofit2.Response<DrivingRouteResponse> response) {
                List<RoutePoint> points = extractBackendGeometry(response);
                if (points != null && points.size() >= 2) {
                    deliverSuccess(callback, points);
                    return;
                }
                fetchPublicOsrmRoute(fromLat, fromLng, toLat, toLng, callback);
            }

            @Override
            public void onFailure(Call<DrivingRouteResponse> call, Throwable t) {
                fetchPublicOsrmRoute(fromLat, fromLng, toLat, toLng, callback);
            }
        });
    }

    private List<RoutePoint> extractBackendGeometry(retrofit2.Response<DrivingRouteResponse> response) {
        if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
            return null;
        }
        DrivingRouteData data = response.body().data;
        List<RoutePoint> points = data.safeGeometry();
        return data.ok && points.size() >= 2 ? points : null;
    }

    private void fetchPublicOsrmRoute(
            double fromLat,
            double fromLng,
            double toLat,
            double toLng,
            RouteCallback callback
    ) {
        executor.execute(() -> {
            List<RoutePoint> points;
            try {
                points = requestPublicRoute(fromLat, fromLng, toLat, toLng);
            } catch (Exception error) {
                points = GeoRouteUtils.buildStraightLine(fromLat, fromLng, toLat, toLng);
            }
            if (points == null || points.isEmpty()) {
                points = GeoRouteUtils.buildStraightLine(fromLat, fromLng, toLat, toLng);
            }
            deliverSuccess(callback, points);
        });
    }

    private void deliverSuccess(RouteCallback callback, List<RoutePoint> points) {
        mainHandler.post(() -> callback.onSuccess(points));
    }

    private List<RoutePoint> requestPublicRoute(double fromLat, double fromLng, double toLat, double toLng) throws IOException {
        String url = String.format(
                Locale.US,
                "%s/route/v1/driving/%f,%f;%f,%f?overview=full&geometries=geojson",
                OSRM_BASE,
                fromLng,
                fromLat,
                toLng,
                toLat
        );

        Request request = new Request.Builder().url(url).get().build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                return fallbackStraightLine(fromLat, fromLng, toLat, toLng);
            }

            String body = response.body().string();
            OsrmResponse payload = gson.fromJson(body, OsrmResponse.class);
            if (payload == null || !"Ok".equals(payload.code) || payload.routes == null || payload.routes.isEmpty()) {
                return fallbackStraightLine(fromLat, fromLng, toLat, toLng);
            }

            List<List<Double>> coordinates = payload.routes.get(0).geometry != null
                    ? payload.routes.get(0).geometry.coordinates
                    : null;
            if (coordinates == null || coordinates.isEmpty()) {
                return fallbackStraightLine(fromLat, fromLng, toLat, toLng);
            }

            List<RoutePoint> points = new ArrayList<>();
            for (List<Double> coordinate : coordinates) {
                if (coordinate == null || coordinate.size() < 2) {
                    continue;
                }
                points.add(new RoutePoint(coordinate.get(1), coordinate.get(0)));
            }
            return points.isEmpty()
                    ? fallbackStraightLine(fromLat, fromLng, toLat, toLng)
                    : points;
        }
    }

    private List<RoutePoint> fallbackStraightLine(double fromLat, double fromLng, double toLat, double toLng) {
        return GeoRouteUtils.buildStraightLine(fromLat, fromLng, toLat, toLng);
    }

    private static class OsrmResponse {
        String code;
        List<OsrmRoute> routes;
    }

    private static class OsrmRoute {
        OsrmGeometry geometry;
    }

    private static class OsrmGeometry {
        @SerializedName("coordinates")
        List<List<Double>> coordinates;
    }
}
