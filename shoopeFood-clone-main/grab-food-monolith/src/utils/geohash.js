const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const EARTH_RADIUS_KM = 6371.0088;
const DEFAULT_GEOHASH_PRECISION = 9;

const toNumber = (value) => Number(value);

const isValidCoordinate = (latitude, longitude) => {
  const lat = toNumber(latitude);
  const lng = toNumber(longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
};

const clampLatitude = (latitude) => Math.max(-90, Math.min(90, latitude));

const normalizeLongitude = (longitude) => {
  if (!Number.isFinite(longitude)) {
    return longitude;
  }

  let normalized = longitude;
  while (normalized < -180) normalized += 360;
  while (normalized > 180) normalized -= 360;
  return normalized;
};

const encodeGeohash = (latitude, longitude, precision = DEFAULT_GEOHASH_PRECISION) => {
  const lat = toNumber(latitude);
  const lng = toNumber(longitude);

  if (!isValidCoordinate(lat, lng)) {
    return "";
  }

  const safePrecision = Math.max(1, Math.min(12, Number(precision) || DEFAULT_GEOHASH_PRECISION));
  let latRange = [-90, 90];
  let lngRange = [-180, 180];
  let geohash = "";
  let bit = 0;
  let charIndex = 0;
  let evenBit = true;

  while (geohash.length < safePrecision) {
    if (evenBit) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (lng >= mid) {
        charIndex = (charIndex << 1) + 1;
        lngRange[0] = mid;
      } else {
        charIndex <<= 1;
        lngRange[1] = mid;
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) {
        charIndex = (charIndex << 1) + 1;
        latRange[0] = mid;
      } else {
        charIndex <<= 1;
        latRange[1] = mid;
      }
    }

    evenBit = !evenBit;
    bit += 1;

    if (bit === 5) {
      geohash += BASE32[charIndex];
      bit = 0;
      charIndex = 0;
    }
  }

  return geohash;
};

const decodeGeohashBounds = (geohash) => {
  if (!geohash) {
    return null;
  }

  let latRange = [-90, 90];
  let lngRange = [-180, 180];
  let evenBit = true;

  for (const char of String(geohash).toLowerCase()) {
    const charIndex = BASE32.indexOf(char);
    if (charIndex === -1) {
      return null;
    }

    for (let mask = 16; mask > 0; mask >>= 1) {
      if (evenBit) {
        const mid = (lngRange[0] + lngRange[1]) / 2;
        if (charIndex & mask) {
          lngRange[0] = mid;
        } else {
          lngRange[1] = mid;
        }
      } else {
        const mid = (latRange[0] + latRange[1]) / 2;
        if (charIndex & mask) {
          latRange[0] = mid;
        } else {
          latRange[1] = mid;
        }
      }

      evenBit = !evenBit;
    }
  }

  return {
    minLat: latRange[0],
    maxLat: latRange[1],
    minLng: lngRange[0],
    maxLng: lngRange[1],
  };
};

const getGeohashPrecisionForRadius = (radiusKm) => {
  const radius = Number(radiusKm);

  if (!Number.isFinite(radius) || radius <= 0) {
    return 5;
  }

  if (radius <= 1) return 6;
  if (radius <= 20) return 5;
  if (radius <= 80) return 4;
  if (radius <= 300) return 3;
  if (radius <= 1200) return 2;
  return 1;
};

const distanceKm = (fromLat, fromLng, toLat, toLng) => {
  if (!isValidCoordinate(fromLat, fromLng) || !isValidCoordinate(toLat, toLng)) {
    return Number.POSITIVE_INFINITY;
  }

  const lat1 = (Number(fromLat) * Math.PI) / 180;
  const lat2 = (Number(toLat) * Math.PI) / 180;
  const deltaLat = ((Number(toLat) - Number(fromLat)) * Math.PI) / 180;
  const deltaLng = ((Number(toLng) - Number(fromLng)) * Math.PI) / 180;

  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const a = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
};

const getCellStepDegrees = (latitude, longitude, precision) => {
  const geohash = encodeGeohash(latitude, longitude, precision);
  const bounds = decodeGeohashBounds(geohash);

  if (!bounds) {
    return { latStep: 0.01, lngStep: 0.01 };
  }

  return {
    latStep: Math.max(0.0001, bounds.maxLat - bounds.minLat),
    lngStep: Math.max(0.0001, bounds.maxLng - bounds.minLng),
  };
};

const getBoundingBox = (latitude, longitude, radiusKm) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const radius = Math.max(0, Number(radiusKm) || 0);
  const latDelta = radius / 110.574;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lngDelta = Math.abs(cosLat) < 0.000001 ? 180 : radius / (111.32 * Math.abs(cosLat));

  return {
    minLat: clampLatitude(lat - latDelta),
    maxLat: clampLatitude(lat + latDelta),
    minLng: Math.max(-180, lng - lngDelta),
    maxLng: Math.min(180, lng + lngDelta),
  };
};

const coverRadiusWithGeohashes = (latitude, longitude, radiusKm, precision = getGeohashPrecisionForRadius(radiusKm)) => {
  if (!isValidCoordinate(latitude, longitude)) {
    return new Set();
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  const safePrecision = Math.max(1, Math.min(12, Number(precision) || getGeohashPrecisionForRadius(radiusKm)));
  const hashes = new Set([encodeGeohash(lat, lng, safePrecision)]);
  const box = getBoundingBox(lat, lng, radiusKm);
  const { latStep, lngStep } = getCellStepDegrees(lat, lng, safePrecision);
  const maxIterations = 10000;
  let iterations = 0;

  for (let latCursor = box.minLat; latCursor <= box.maxLat + latStep / 2; latCursor += latStep) {
    for (let lngCursor = box.minLng; lngCursor <= box.maxLng + lngStep / 2; lngCursor += lngStep) {
      if (iterations >= maxIterations) {
        return hashes;
      }

      hashes.add(
        encodeGeohash(
          clampLatitude(latCursor),
          normalizeLongitude(lngCursor),
          safePrecision
        )
      );
      iterations += 1;
    }
  }

  return hashes;
};

const isGeohashInSet = (geohash, prefixes) => {
  if (!geohash || !prefixes || prefixes.size === 0) {
    return false;
  }

  for (const prefix of prefixes) {
    if (String(geohash).startsWith(prefix)) {
      return true;
    }
  }

  return false;
};

module.exports = {
  DEFAULT_GEOHASH_PRECISION,
  coverRadiusWithGeohashes,
  decodeGeohashBounds,
  distanceKm,
  encodeGeohash,
  getGeohashPrecisionForRadius,
  isGeohashInSet,
  isValidCoordinate,
};
