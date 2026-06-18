package com.shoopefood.mobile.map;

import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.Drawable;

import com.shoopefood.mobile.R;
import com.shoopefood.mobile.model.RoutePoint;
import com.shoopefood.mobile.model.TrackingRouteLeg;
import com.shoopefood.mobile.util.GeoUtils;
import com.shoopefood.mobile.util.MapMarkerUtils;

import org.osmdroid.tileprovider.tilesource.XYTileSource;
import org.osmdroid.util.BoundingBox;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.CustomZoomButtonsController;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Marker;
import org.osmdroid.views.overlay.Polyline;

import java.util.ArrayList;
import java.util.List;

public class CustomerTrackingMapController {

    private static final double DEFAULT_LAT = 10.7769;
    private static final double DEFAULT_LNG = 106.7009;

    private final MapView mapView;
    private final Context context;
    private Marker driverMarker;
    private String lastRouteKey = "";

    public CustomerTrackingMapController(MapView mapView) {
        this.mapView = mapView;
        this.context = mapView.getContext();
        setupMap();
    }

    private void setupMap() {
        XYTileSource tileSource = new XYTileSource(
                "CartoVoyager",
                0,
                20,
                256,
                ".png",
                new String[]{"https://a.basemaps.cartocdn.com/rastertiles/voyager/"},
                "OpenStreetMap contributors, CARTO"
        );

        mapView.setTileSource(tileSource);
        mapView.setMultiTouchControls(true);
        mapView.setHorizontalMapRepetitionEnabled(false);
        mapView.setVerticalMapRepetitionEnabled(false);
        mapView.getZoomController().setVisibility(CustomZoomButtonsController.Visibility.SHOW_AND_FADEOUT);
        mapView.setMinZoomLevel(5.0);
        mapView.setMaxZoomLevel(19.0);
        mapView.getController().setZoom(13.0);
        mapView.getController().setCenter(new GeoPoint(DEFAULT_LAT, DEFAULT_LNG));
    }

    public void showTracking(TrackingSnapshot snapshot) {
        if (snapshot == null) {
            return;
        }

        String routeKey = buildRouteKey(snapshot);
        if (!routeKey.equals(lastRouteKey)) {
            lastRouteKey = routeKey;
            mapView.getOverlays().clear();
            driverMarker = null;
            renderStaticOverlays(snapshot);
        }

        updateDriverMarker(snapshot);
        mapView.invalidate();
    }

    private void renderStaticOverlays(TrackingSnapshot snapshot) {
        List<GeoPoint> bounds = new ArrayList<>();

        if (snapshot.legs != null) {
            for (TrackingRouteLeg leg : snapshot.legs) {
                if (leg == null || leg.geometry == null || leg.geometry.isEmpty()) {
                    continue;
                }
                Polyline polyline = new Polyline();
                List<GeoPoint> points = toGeoPoints(leg.geometry);
                polyline.setPoints(points);
                polyline.setWidth(18f);
                polyline.setGeodesic(true);
                if ("driver_to_restaurant".equals(leg.key)) {
                    polyline.setColor(Color.parseColor("#FF6B00"));
                } else {
                    polyline.setColor(Color.parseColor("#00B14F"));
                }
                mapView.getOverlays().add(polyline);
                bounds.addAll(points);
            }
        }

        if (GeoUtils.isValidCoordinate(snapshot.restaurantLat, snapshot.restaurantLng)) {
            GeoPoint restaurantPoint = new GeoPoint(snapshot.restaurantLat, snapshot.restaurantLng);
            bounds.add(restaurantPoint);
            Marker restaurantMarker = new Marker(mapView);
            restaurantMarker.setPosition(restaurantPoint);
            restaurantMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
            restaurantMarker.setTitle(snapshot.restaurantName);
            restaurantMarker.setIcon(getPinIcon(R.drawable.ic_map_pin_restaurant, 42f));
            mapView.getOverlays().add(restaurantMarker);
        }

        if (snapshot.customerLat != null
                && snapshot.customerLng != null
                && GeoUtils.isValidCoordinate(snapshot.customerLat, snapshot.customerLng)) {
            GeoPoint customerPoint = new GeoPoint(snapshot.customerLat, snapshot.customerLng);
            bounds.add(customerPoint);
            Marker customerMarker = new Marker(mapView);
            customerMarker.setPosition(customerPoint);
            customerMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
            customerMarker.setTitle(context.getString(R.string.driver_map_customer));
            customerMarker.setIcon(getPinIcon(R.drawable.ic_map_pin_customer, 42f));
            mapView.getOverlays().add(customerMarker);
        }

        if (snapshot.driverLat != null
                && snapshot.driverLng != null
                && GeoUtils.isValidCoordinate(snapshot.driverLat, snapshot.driverLng)) {
            bounds.add(new GeoPoint(snapshot.driverLat, snapshot.driverLng));
        }

        fitBounds(bounds);
    }

    private void updateDriverMarker(TrackingSnapshot snapshot) {
        if (snapshot.driverLat == null
                || snapshot.driverLng == null
                || !GeoUtils.isValidCoordinate(snapshot.driverLat, snapshot.driverLng)) {
            return;
        }

        GeoPoint driverPoint = new GeoPoint(snapshot.driverLat, snapshot.driverLng);
        if (driverMarker == null) {
            driverMarker = new Marker(mapView);
            driverMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
            driverMarker.setTitle(snapshot.driverName != null ? snapshot.driverName : context.getString(R.string.driver_map_you));
            driverMarker.setIcon(getPinIcon(R.drawable.ic_map_pin_driver, 48f));
            driverMarker.setInfoWindow(null);
            mapView.getOverlays().add(driverMarker);
        }

        driverMarker.setPosition(driverPoint);
        if (snapshot.driverName != null) {
            driverMarker.setTitle(snapshot.driverName);
        }
    }

    private String buildRouteKey(TrackingSnapshot snapshot) {
        StringBuilder builder = new StringBuilder();
        if (snapshot.legs != null) {
            for (TrackingRouteLeg leg : snapshot.legs) {
                if (leg == null || leg.geometry == null) {
                    continue;
                }
                builder.append(leg.key).append(':').append(leg.geometry.size()).append('|');
            }
        }
        builder.append(snapshot.restaurantLat).append(',').append(snapshot.restaurantLng).append('|');
        builder.append(snapshot.customerLat).append(',').append(snapshot.customerLng);
        return builder.toString();
    }

    private Drawable getPinIcon(int drawableRes, float sizeDp) {
        return MapMarkerUtils.toMarkerIcon(context, drawableRes, sizeDp);
    }

    private List<GeoPoint> toGeoPoints(List<RoutePoint> route) {
        List<GeoPoint> points = new ArrayList<>();
        for (RoutePoint point : route) {
            points.add(new GeoPoint(point.latitude, point.longitude));
        }
        return points;
    }

    private void fitBounds(List<GeoPoint> points) {
        if (points.isEmpty()) {
            mapView.getController().animateTo(new GeoPoint(DEFAULT_LAT, DEFAULT_LNG));
            mapView.getController().setZoom(12.0);
            return;
        }
        if (points.size() == 1 || mapView.getWidth() == 0 || mapView.getHeight() == 0) {
            mapView.getController().setCenter(points.get(0));
            mapView.getController().setZoom(15.0);
            return;
        }

        try {
            BoundingBox bounds = BoundingBox.fromGeoPoints(points);
            mapView.zoomToBoundingBox(bounds.increaseByScale(1.2f), true, 100);
        } catch (Exception ignored) {}
    }

    public void onResume() {
        mapView.onResume();
    }

    public void onPause() {
        mapView.onPause();
    }

    public static class TrackingSnapshot {
        public final Double driverLat;
        public final Double driverLng;
        public final String driverName;
        public final String restaurantName;
        public final double restaurantLat;
        public final double restaurantLng;
        public final Double customerLat;
        public final Double customerLng;
        public final List<TrackingRouteLeg> legs;

        public TrackingSnapshot(
                Double driverLat,
                Double driverLng,
                String driverName,
                String restaurantName,
                double restaurantLat,
                double restaurantLng,
                Double customerLat,
                Double customerLng,
                List<TrackingRouteLeg> legs
        ) {
            this.driverLat = driverLat;
            this.driverLng = driverLng;
            this.driverName = driverName;
            this.restaurantName = restaurantName;
            this.restaurantLat = restaurantLat;
            this.restaurantLng = restaurantLng;
            this.customerLat = customerLat;
            this.customerLng = customerLng;
            this.legs = legs;
        }
    }
}
