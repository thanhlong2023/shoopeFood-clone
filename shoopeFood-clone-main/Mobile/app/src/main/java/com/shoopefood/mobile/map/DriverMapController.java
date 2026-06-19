package com.shoopefood.mobile.map;

import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.Drawable;

import com.shoopefood.mobile.R;
import com.shoopefood.mobile.model.RestaurantMapPin;
import com.shoopefood.mobile.model.RoutePoint;
import com.shoopefood.mobile.util.GeoUtils;
import com.shoopefood.mobile.util.MapMarkerUtils;

import org.osmdroid.tileprovider.tilesource.XYTileSource;
import org.osmdroid.util.BoundingBox;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.CustomZoomButtonsController;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Marker;
import org.osmdroid.views.overlay.Polygon;
import org.osmdroid.views.overlay.Polyline;

import java.util.ArrayList;
import java.util.List;

public class DriverMapController {

    private static final double DEFAULT_LAT = 10.7769;
    private static final double DEFAULT_LNG = 106.7009;
    private static final double RADIUS_KM = 10.0;

    private final MapView mapView;
    private final Context context;

    private Marker driverMarker;
    private Polyline routePolyline;
    private DeliveryMapSnapshot lastDeliverySnapshot;

    public DriverMapController(MapView mapView) {
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

    public void update(
            Double driverLat,
            Double driverLng,
            List<RestaurantMapPin> restaurantPins,
            boolean isOnline
    ) {
        lastDeliverySnapshot = null;
        mapView.getOverlays().clear();
        driverMarker = null;
        routePolyline = null;

        if (!isOnline || driverLat == null || driverLng == null
                || !GeoUtils.isValidCoordinate(driverLat, driverLng)) {
            mapView.getController().animateTo(new GeoPoint(DEFAULT_LAT, DEFAULT_LNG));
            mapView.getController().setZoom(12.0);
            mapView.invalidate();
            return;
        }

        GeoPoint driverPoint = new GeoPoint(driverLat, driverLng);
        addRadiusCircle(driverPoint);

        List<GeoPoint> boundsPoints = new ArrayList<>();
        boundsPoints.add(driverPoint);

        if (restaurantPins != null) {
            for (RestaurantMapPin pin : restaurantPins) {
                if (!GeoUtils.isValidCoordinate(pin.latitude, pin.longitude)) {
                    continue;
                }
                GeoPoint restaurantPoint = new GeoPoint(pin.latitude, pin.longitude);
                boundsPoints.add(restaurantPoint);
                addRestaurantMarker(restaurantPoint, pin);
            }
        }

        addDriverMarker(driverPoint);
        fitBounds(boundsPoints);
        mapView.invalidate();
    }

    public void showDeliveryRoute(DeliveryMapSnapshot snapshot) {
        if (snapshot == null || !GeoUtils.isValidCoordinate(snapshot.driverLat, snapshot.driverLng)) {
            return;
        }

        boolean sameRoute = lastDeliverySnapshot != null
                && lastDeliverySnapshot.routeLeg.equals(snapshot.routeLeg)
                && routePolyline != null
                && snapshot.routePolyline != null
                && !snapshot.routePolyline.isEmpty();

        if (!sameRoute || driverMarker == null) {
            rebuildDeliveryOverlays(snapshot);
        } else {
            updateDriverMarkerPosition(snapshot.driverLat, snapshot.driverLng);
        }

        lastDeliverySnapshot = snapshot;
        mapView.invalidate();
    }

    private void rebuildDeliveryOverlays(DeliveryMapSnapshot snapshot) {
        mapView.getOverlays().clear();
        driverMarker = null;
        routePolyline = null;

        List<GeoPoint> bounds = new ArrayList<>();
        bounds.add(new GeoPoint(snapshot.driverLat, snapshot.driverLng));

        if (snapshot.routePolyline != null && !snapshot.routePolyline.isEmpty()) {
            routePolyline = new Polyline();
            routePolyline.setPoints(toGeoPoints(snapshot.routePolyline));
            routePolyline.setColor(snapshot.routeLegToCustomer
                    ? Color.parseColor("#00B14F")
                    : Color.parseColor("#FF6B00"));
            routePolyline.setWidth(18f);
            routePolyline.setGeodesic(true);
            mapView.getOverlays().add(routePolyline);
            bounds.addAll(routePolyline.getPoints());
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

        if (snapshot.showCustomer
                && snapshot.customerLat != null
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

        addDriverMarker(new GeoPoint(snapshot.driverLat, snapshot.driverLng));
        fitBounds(bounds);
    }

    public void updateDriverMarkerPosition(double driverLat, double driverLng) {
        if (driverMarker == null) {
            addDriverMarker(new GeoPoint(driverLat, driverLng));
            return;
        }
        driverMarker.setPosition(new GeoPoint(driverLat, driverLng));
    }

    private void addRadiusCircle(GeoPoint center) {
        Polygon radiusCircle = new Polygon();
        radiusCircle.setPoints(Polygon.pointsAsCircle(center, RADIUS_KM * 1000));
        radiusCircle.setFillColor(Color.argb(35, 0, 177, 79));
        radiusCircle.setStrokeColor(Color.argb(200, 0, 122, 61));
        radiusCircle.setStrokeWidth(3f);
        mapView.getOverlays().add(radiusCircle);
    }

    private void addDriverMarker(GeoPoint point) {
        driverMarker = new Marker(mapView);
        driverMarker.setPosition(point);
        driverMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
        driverMarker.setTitle(context.getString(R.string.driver_map_you));
        driverMarker.setIcon(getPinIcon(R.drawable.ic_map_pin_driver, 48f));
        driverMarker.setInfoWindow(null);
        mapView.getOverlays().add(driverMarker);
    }

    private void addRestaurantMarker(GeoPoint point, RestaurantMapPin pin) {
        Marker marker = new Marker(mapView);
        marker.setPosition(point);
        marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
        marker.setTitle(pin.name != null ? pin.name : ("Quán #" + pin.restaurantId));
        marker.setSnippet(context.getString(
                R.string.driver_map_restaurant_snippet,
                pin.orderCount,
                pin.distanceKm
        ));
        marker.setIcon(getPinIcon(R.drawable.ic_map_pin_restaurant, 42f));
        mapView.getOverlays().add(marker);
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
            return;
        }
        if (points.size() == 1) {
            mapView.getController().animateTo(points.get(0));
            mapView.getController().setZoom(15.0);
            return;
        }

        BoundingBox bounds = BoundingBox.fromGeoPoints(points);
        mapView.post(() -> mapView.zoomToBoundingBox(bounds.increaseByScale(1.2f), true, 100));
    }

    public void onResume() {
        mapView.onResume();
    }

    public void onPause() {
        mapView.onPause();
    }

    public static class DeliveryMapSnapshot {
        public final double driverLat;
        public final double driverLng;
        public final List<RoutePoint> routePolyline;
        public final boolean routeLegToCustomer;
        public final String restaurantName;
        public final double restaurantLat;
        public final double restaurantLng;
        public final boolean showCustomer;
        public final Double customerLat;
        public final Double customerLng;
        public final String routeLeg;

        public DeliveryMapSnapshot(
                double driverLat,
                double driverLng,
                List<RoutePoint> routePolyline,
                boolean routeLegToCustomer,
                String restaurantName,
                double restaurantLat,
                double restaurantLng,
                boolean showCustomer,
                Double customerLat,
                Double customerLng,
                String routeLeg
        ) {
            this.driverLat = driverLat;
            this.driverLng = driverLng;
            this.routePolyline = routePolyline;
            this.routeLegToCustomer = routeLegToCustomer;
            this.restaurantName = restaurantName;
            this.restaurantLat = restaurantLat;
            this.restaurantLng = restaurantLng;
            this.showCustomer = showCustomer;
            this.customerLat = customerLat;
            this.customerLng = customerLng;
            this.routeLeg = routeLeg != null ? routeLeg : "";
        }
    }
}
