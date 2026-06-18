const {
  coverRadiusWithGeohashes,
  distanceKm,
  encodeGeohash,
  getGeohashPrecisionForRadius,
  isGeohashInSet,
  isValidCoordinate,
} = require("../utils/geohash");

const DEFAULT_SEARCH_RADIUS_KM = 10;

const toPoint = (input) => {
  if (!input) {
    return null;
  }

  const latitude = Number(input.latitude ?? input.lat);
  const longitude = Number(input.longitude ?? input.lng);

  if (!isValidCoordinate(latitude, longitude)) {
    return null;
  }

  return { latitude, longitude };
};

const getDriverPoint = (driver) =>
  toPoint(driver) ||
  toPoint(driver?.location) ||
  toPoint(driver?.latestLocation) ||
  toPoint(driver?.driverLocation);

const getOrderPickupPoint = (order) =>
  toPoint(order?.Restaurant) ||
  toPoint(order?.restaurant) ||
  toPoint(order?.restaurantInfo);

const getSearchConfig = (options = {}) => {
  const radiusKm = Number.isFinite(Number(options.radiusKm))
    ? Math.max(0, Number(options.radiusKm))
    : DEFAULT_SEARCH_RADIUS_KM;
  const precision = Number.isFinite(Number(options.precision))
    ? Math.max(1, Math.min(12, Number(options.precision)))
    : getGeohashPrecisionForRadius(radiusKm);

  return { radiusKm, precision };
};

const withDistanceFrom = (item, point, originPoint) => ({
  item,
  point,
  distanceKm: distanceKm(originPoint.latitude, originPoint.longitude, point.latitude, point.longitude),
});

const sortByDistance = (left, right) => left.distanceKm - right.distanceKm;

const filterByGeohashWindow = (items, originPoint, options = {}) => {
  const { radiusKm, precision } = getSearchConfig(options);
  const prefixes = coverRadiusWithGeohashes(originPoint.latitude, originPoint.longitude, radiusKm, precision);

  return items.filter(({ item, point }) => {
    const itemGeohash = item.geohash || item.location?.geohash || encodeGeohash(point.latitude, point.longitude, precision);
    return isGeohashInSet(itemGeohash, prefixes);
  });
};

const rankWithinRadius = (items, originPoint, options = {}) => {
  const { radiusKm } = getSearchConfig(options);
  const geohashCandidates = filterByGeohashWindow(items, originPoint, options);

  return geohashCandidates
    .map(({ item, point }) => withDistanceFrom(item, point, originPoint))
    .filter((candidate) => candidate.distanceKm <= radiusKm)
    .sort(sortByDistance);
};

exports.DEFAULT_SEARCH_RADIUS_KM = DEFAULT_SEARCH_RADIUS_KM;

exports.findNearbyDrivers = (drivers = [], pickupPoint, options = {}) => {
  const originPoint = toPoint(pickupPoint);
  if (!originPoint || !Array.isArray(drivers) || drivers.length === 0) {
    return [];
  }

  const driversWithPoints = drivers
    .map((driver) => ({ item: driver, point: getDriverPoint(driver) }))
    .filter((driver) => driver.point);

  return rankWithinRadius(driversWithPoints, originPoint, options).map(({ item, distanceKm: driverDistanceKm }) => ({
    ...item,
    distanceKm: Number(driverDistanceKm.toFixed(3)),
  }));
};

exports.findNearestDriver = (drivers = [], pickupPoint, options = {}) => {
  const originPoint = toPoint(pickupPoint);
  if (!originPoint || !Array.isArray(drivers) || drivers.length === 0) {
    return null;
  }

  const nearbyDrivers = exports.findNearbyDrivers(drivers, originPoint, options);
  if (nearbyDrivers.length > 0) {
    return nearbyDrivers[0];
  }

  const driversWithPoints = drivers
    .map((driver) => ({ item: driver, point: getDriverPoint(driver) }))
    .filter((driver) => driver.point);

  if (driversWithPoints.length === 0) {
    return null;
  }

  const nearest = driversWithPoints
    .map(({ item, point }) => withDistanceFrom(item, point, originPoint))
    .sort(sortByDistance)[0];

  return {
    ...nearest.item,
    distanceKm: Number(nearest.distanceKm.toFixed(3)),
  };
};

exports.filterOrdersNearPoint = (orders = [], driverPoint, options = {}) => {
  const originPoint = toPoint(driverPoint);
  if (!originPoint || !Array.isArray(orders) || orders.length === 0) {
    return [];
  }

  const ordersWithPoints = orders
    .map((order) => ({ item: order, point: getOrderPickupPoint(order) }))
    .filter((order) => order.point);

  return rankWithinRadius(ordersWithPoints, originPoint, options).map(({ item }) => item);
};

exports.hasValidPoint = (input) => Boolean(toPoint(input));
