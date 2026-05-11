const OSRM_URL = process.env.OSRM_URL || "http://router.project-osrm.org";

exports.buildRouteUrl = (fromLng, fromLat, toLng, toLat) => {
  return `${OSRM_URL}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
};
