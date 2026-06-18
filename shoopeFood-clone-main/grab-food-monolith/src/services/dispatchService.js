const { Op } = require("sequelize");
const { DriverDetail, DriverLocation, Order, OrderStatus, Restaurant, User } = require("../models");
const driverService = require("./driverService");
const { DRIVER_ACTIVE_STATUS_CODES } = require("./orderWorkflowService");
const { coverRadiusWithGeohashes, getGeohashPrecisionForRadius, isValidCoordinate } = require("../utils/geohash");

const DISPATCH_ALGORITHM = "GEOHASH_RING_SCORE_V1";
const DISPATCH_SEARCH_RADII_KM = [3, 5, 10, 20];
const MAX_LOCATION_AGE_MS = 5 * 60 * 1000;
const DEFAULT_DRIVER_LIMIT = 5;
const CITY_SPEED_KMH = 22;

const driverInclude = [{ model: User, as: "driverUser", attributes: ["id", "fullName", "phone", "ratingAvg"] }];

const toPickupPoint = async (order) => {
  const restaurant = order?.restaurant || order?.Restaurant || order?.restaurantInfo || null;
  if (restaurant && isValidCoordinate(restaurant.latitude, restaurant.longitude)) {
    return {
      restaurant,
      latitude: Number(restaurant.latitude),
      longitude: Number(restaurant.longitude),
    };
  }

  const restaurantId = Number(order?.restaurantId);
  if (!Number.isFinite(restaurantId)) {
    return null;
  }

  const item = await Restaurant.findByPk(restaurantId);
  if (!item || !isValidCoordinate(item.latitude, item.longitude)) {
    return null;
  }

  return {
    restaurant: item,
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
  };
};

const getActiveDriverIds = async (driverIds) => {
  if (!driverIds.length) {
    return new Set();
  }

  const statuses = await OrderStatus.findAll({
    where: { code: { [Op.in]: DRIVER_ACTIVE_STATUS_CODES } },
    attributes: ["id"],
  });
  const statusIds = statuses.map((status) => status.id).filter(Boolean);
  if (!statusIds.length) {
    return new Set();
  }

  const activeOrders = await Order.findAll({
    where: {
      driverId: { [Op.in]: driverIds },
      statusId: { [Op.in]: statusIds },
    },
    attributes: ["driverId"],
  });

  return new Set(activeOrders.map((order) => Number(order.driverId)).filter(Boolean));
};

const getLatestLocationsByDriver = async (driverIds) => {
  if (!driverIds.length) {
    return new Map();
  }

  const locations = await DriverLocation.findAll({
    where: { driverId: { [Op.in]: driverIds } },
    order: [["created_at", "DESC"]],
  });
  const latestByDriverId = new Map();

  for (const location of locations) {
    if (!latestByDriverId.has(Number(location.driverId))) {
      latestByDriverId.set(Number(location.driverId), location);
    }
  }

  return latestByDriverId;
};

const toDriverCandidate = (driver, location, now) => {
  if (!location || !isValidCoordinate(location.latitude, location.longitude)) {
    return null;
  }

  const locationAgeMs = now - new Date(location.createdAt || Date.now()).getTime();
  if (locationAgeMs > MAX_LOCATION_AGE_MS) {
    return null;
  }

  const user = driver.driverUser || {};
  return {
    id: driver.userId,
    driverId: driver.userId,
    fullName: user.fullName || "",
    phone: user.phone || "",
    ratingAvg: Number(user.ratingAvg || 0),
    vehicleType: driver.vehicleType || "",
    licensePlate: driver.licensePlate || "",
    isOnline: Boolean(driver.isOnline),
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    geohash: location.geohash || null,
    locationAgeSeconds: Math.max(0, Math.round(locationAgeMs / 1000)),
  };
};

const scoreCandidate = (candidate) => {
  const ratingPenalty = Math.max(0, 5 - Number(candidate.ratingAvg || 0)) * 1.5;
  const freshnessPenalty = Math.min(10, Number(candidate.locationAgeSeconds || 0) / 60) * 0.2;
  const pickupEtaMinutes = Number(((Number(candidate.distanceKm || 0) / CITY_SPEED_KMH) * 60).toFixed(1));
  const dispatchScore = Number(
    (Number(candidate.distanceKm || 0) * 4 + pickupEtaMinutes * 0.5 + ratingPenalty + freshnessPenalty).toFixed(3)
  );

  return {
    ...candidate,
    pickupEtaMinutes,
    dispatchScore,
  };
};

const findDriverCandidatesForOrder = async (order, options = {}) => {
  const pickupPoint = await toPickupPoint(order);
  if (!pickupPoint) {
    return {
      algorithm: DISPATCH_ALGORITHM,
      searchRadiusKm: null,
      candidates: [],
      reason: "PICKUP_LOCATION_UNAVAILABLE",
    };
  }

  const radii = Array.isArray(options.searchRadiiKm) && options.searchRadiiKm.length
    ? options.searchRadiiKm
    : DISPATCH_SEARCH_RADII_KM;
  const limit = Number.isFinite(Number(options.limit)) ? Math.max(1, Number(options.limit)) : DEFAULT_DRIVER_LIMIT;
  const now = Date.now();
  const cutoffTime = new Date(now - MAX_LOCATION_AGE_MS);

  for (const radiusKm of radii) {
    const precision = getGeohashPrecisionForRadius(radiusKm);
    const prefixes = coverRadiusWithGeohashes(pickupPoint.latitude, pickupPoint.longitude, radiusKm, precision);
    const prefixArray = Array.from(prefixes);

    if (prefixArray.length === 0) continue;

    // 1. Dùng Geohash Index để tìm các location gần đây thay vì load tất cả driver
    const locations = await DriverLocation.findAll({
      where: {
        createdAt: { [Op.gte]: cutoffTime },
        [Op.or]: prefixArray.map(prefix => ({ geohash: { [Op.startsWith]: prefix } }))
      },
      order: [["created_at", "DESC"]],
    });

    const latestByDriverId = new Map();
    for (const location of locations) {
      if (!latestByDriverId.has(Number(location.driverId))) {
        latestByDriverId.set(Number(location.driverId), location);
      }
    }

    const candidateDriverIds = Array.from(latestByDriverId.keys());
    if (candidateDriverIds.length === 0) continue;

    // 2. Chỉ load DriverDetail của những tài xế nằm trong khu vực
    const onlineDrivers = await DriverDetail.findAll({
      where: {
        userId: { [Op.in]: candidateDriverIds },
        approvalStatus: "APPROVED",
        isOnline: true,
      },
      include: driverInclude,
    });

    const onlineDriverIds = onlineDrivers.map((driver) => Number(driver.userId)).filter(Boolean);
    if (onlineDriverIds.length === 0) continue;

    // 3. Lọc bỏ các tài xế đang bận đơn
    const activeDriverIds = await getActiveDriverIds(onlineDriverIds);
    const availableDrivers = onlineDrivers.filter((driver) => !activeDriverIds.has(Number(driver.userId)));

    if (availableDrivers.length === 0) continue;

    const driversWithLocations = availableDrivers
      .map((driver) => toDriverCandidate(driver, latestByDriverId.get(Number(driver.userId)), now))
      .filter(Boolean);

    // 4. Tính khoảng cách chính xác (Haversine) và lọc lần cuối
    const nearby = driverService.findNearbyDrivers(driversWithLocations, pickupPoint, { radiusKm });
    if (nearby.length > 0) {
      return {
        algorithm: DISPATCH_ALGORITHM,
        searchRadiusKm: radiusKm,
        candidates: nearby.map(scoreCandidate).sort((left, right) => left.dispatchScore - right.dispatchScore).slice(0, limit),
      };
    }
  }

  return {
    algorithm: DISPATCH_ALGORITHM,
    searchRadiusKm: radii[radii.length - 1] || null,
    candidates: [],
    reason: "NO_AVAILABLE_DRIVER_IN_RADIUS",
  };
};

module.exports = {
  CITY_SPEED_KMH,
  DEFAULT_DRIVER_LIMIT,
  DISPATCH_ALGORITHM,
  DISPATCH_SEARCH_RADII_KM,
  findDriverCandidatesForOrder,
};
