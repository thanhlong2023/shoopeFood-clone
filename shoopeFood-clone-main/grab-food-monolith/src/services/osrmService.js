const OSRM_URL = process.env.OSRM_URL || "http://router.project-osrm.org";

exports.buildRouteUrl = (fromLng, fromLat, toLng, toLat) => {
  return `${OSRM_URL}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=true`;
};

const toPoint = (point) => ({
  latitude: Number(point?.latitude ?? point?.lat ?? 0),
  longitude: Number(point?.longitude ?? point?.lng ?? 0),
});

const hasValidPoint = (point) =>
  Number.isFinite(Number(point?.latitude)) &&
  Number.isFinite(Number(point?.longitude)) &&
  Math.abs(Number(point.latitude)) <= 90 &&
  Math.abs(Number(point.longitude)) <= 180;

const normalizeManeuver = (maneuver = {}) => {
  const type = maneuver.type ? String(maneuver.type).replace(/_/g, " ") : "continue";
  const modifier = maneuver.modifier ? ` ${String(maneuver.modifier).replace(/_/g, " ")}` : "";
  return `${type}${modifier}`.trim();
};

const normalizeStep = (step = {}) => {
  const maneuverLocation = Array.isArray(step.maneuver?.location)
    ? { latitude: Number(step.maneuver.location[1]), longitude: Number(step.maneuver.location[0]) }
    : null;

  return {
    instruction: normalizeManeuver(step.maneuver),
    name: step.name || "",
    distanceKm: Number(((step.distance || 0) / 1000).toFixed(2)),
    durationMinutes: Number(((step.duration || 0) / 60).toFixed(1)),
    location: maneuverLocation,
  };
};

const emptyRoute = (error) => ({
  ok: false,
  provider: "OSRM",
  distanceKm: 0,
  durationMinutes: 0,
  geometry: [],
  steps: [],
  error,
});

exports.getRoute = async (fromInput, toInput) => {
  const from = toPoint(fromInput);
  const to = toPoint(toInput);

  if (!hasValidPoint(from) || !hasValidPoint(to)) {
    return emptyRoute("Invalid route coordinates");
  }

  try {
    const response = await fetch(exports.buildRouteUrl(from.longitude, from.latitude, to.longitude, to.latitude));
    if (!response.ok) {
      return emptyRoute(`OSRM request failed with ${response.status}`);
    }

    const payload = await response.json();
    if (payload.code !== "Ok" || !payload.routes || !payload.routes[0]) {
      return emptyRoute(payload.message || payload.code || "OSRM route not found");
    }

    const route = payload.routes[0];
    const leg = route.legs && route.legs[0] ? route.legs[0] : null;
    const coordinates = route.geometry?.coordinates || [];

    return {
      ok: true,
      provider: "OSRM",
      distanceKm: Number(((route.distance || 0) / 1000).toFixed(2)),
      durationMinutes: Number(((route.duration || 0) / 60).toFixed(1)),
      geometry: coordinates.map(([longitude, latitude]) => ({
        latitude: Number(latitude),
        longitude: Number(longitude),
      })),
      steps: leg?.steps ? leg.steps.map(normalizeStep) : [],
      error: null,
    };
  } catch (error) {
    return emptyRoute(error.message || "OSRM request failed");
  }
};
