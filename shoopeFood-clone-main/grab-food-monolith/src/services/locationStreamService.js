const { distanceKm, encodeGeohash, isValidCoordinate } = require("../utils/geohash");

const EMIT_MIN_INTERVAL_MS = 3000;
const EMIT_MIN_DISTANCE_KM = 0.02;
const PERSIST_MIN_INTERVAL_MS = 15000;
const PERSIST_MIN_DISTANCE_KM = 0.1;

const latestByDriverId = new Map();

const toTimestamp = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : Date.now();
};

const sameOrder = (left, right) => {
  if (!left && !right) {
    return true;
  }

  return Number(left || 0) === Number(right || 0);
};

const getDistanceFrom = (snapshot, latitude, longitude) => {
  if (!snapshot || !isValidCoordinate(snapshot.latitude, snapshot.longitude)) {
    return Number.POSITIVE_INFINITY;
  }

  return distanceKm(snapshot.latitude, snapshot.longitude, latitude, longitude);
};

const evaluateLocation = ({ driverId, orderId = null, latitude, longitude, now = Date.now() }) => {
  const normalizedDriverId = Number(driverId);
  const normalizedOrderId = orderId === null || orderId === undefined ? null : Number(orderId);
  const normalizedLatitude = Number(latitude);
  const normalizedLongitude = Number(longitude);

  if (!Number.isFinite(normalizedDriverId) || !isValidCoordinate(normalizedLatitude, normalizedLongitude)) {
    return {
      ok: false,
      message: "Invalid driver location",
    };
  }

  const current = latestByDriverId.get(normalizedDriverId);
  const movedFromLatestKm = getDistanceFrom(current, normalizedLatitude, normalizedLongitude);
  const movedFromPersistedKm = current?.persistedSnapshot
    ? getDistanceFrom(current.persistedSnapshot, normalizedLatitude, normalizedLongitude)
    : Number.POSITIVE_INFINITY;
  const orderChanged = !sameOrder(current?.orderId, normalizedOrderId);
  const msSinceEmit = current?.emittedAtMs ? now - current.emittedAtMs : Number.POSITIVE_INFINITY;
  const msSincePersist = current?.persistedAtMs ? now - current.persistedAtMs : Number.POSITIVE_INFINITY;

  return {
    ok: true,
    shouldEmit: !current || orderChanged || msSinceEmit >= EMIT_MIN_INTERVAL_MS || movedFromLatestKm >= EMIT_MIN_DISTANCE_KM,
    shouldPersist:
      !current ||
      orderChanged ||
      msSincePersist >= PERSIST_MIN_INTERVAL_MS ||
      movedFromPersistedKm >= PERSIST_MIN_DISTANCE_KM,
    location: {
      driverId: normalizedDriverId,
      orderId: normalizedOrderId,
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
      geohash: encodeGeohash(normalizedLatitude, normalizedLongitude),
      createdAt: new Date(now),
    },
  };
};

const rememberLocation = (location, { emitted = false, persisted = false } = {}) => {
  if (!location || !Number.isFinite(Number(location.driverId))) {
    return null;
  }

  const driverId = Number(location.driverId);
  const now = toTimestamp(location.createdAt);
  const current = latestByDriverId.get(driverId) || {};
  const snapshot = {
    id: location.id || current.id || null,
    driverId,
    orderId: location.orderId === undefined ? current.orderId || null : location.orderId,
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    geohash: location.geohash || encodeGeohash(location.latitude, location.longitude),
    heading: Number(location.heading || 0),
    speedKmh: Number(location.speedKmh || 0),
    createdAt: location.createdAt || new Date(now),
  };

  const next = {
    ...snapshot,
    emittedAtMs: emitted ? now : current.emittedAtMs,
    persistedAtMs: persisted ? now : current.persistedAtMs,
    persistedSnapshot: persisted ? snapshot : current.persistedSnapshot,
  };
  latestByDriverId.set(driverId, next);
  return next;
};

const getLatestLocation = (driverId, orderId) => {
  const latest = latestByDriverId.get(Number(driverId));
  if (!latest) {
    return null;
  }

  if (orderId !== undefined && orderId !== null && !sameOrder(latest.orderId, Number(orderId))) {
    return null;
  }

  return latest;
};

module.exports = {
  EMIT_MIN_DISTANCE_KM,
  EMIT_MIN_INTERVAL_MS,
  PERSIST_MIN_DISTANCE_KM,
  PERSIST_MIN_INTERVAL_MS,
  evaluateLocation,
  getLatestLocation,
  rememberLocation,
};
