const normalizeAddress = require("../utils/normalize-address");

const VIETMAP_AUTOCOMPLETE_URL = "https://maps.vietmap.vn/api/autocomplete/v4";
const VIETMAP_PLACE_URL = "https://maps.vietmap.vn/api/place/v4";
const VIETMAP_REVERSE_URL = "https://maps.vietmap.vn/api/reverse/v4";
const DEFAULT_FOCUS = "10.7769,106.7009";

class VietMapProviderError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = "VietMapProviderError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const getApiKey = () => String(process.env.VIETMAP_API_KEY || "").trim();

const ensureApiKey = () => {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new VietMapProviderError("VIETMAP_API_KEY is not configured", 500, "VIETMAP_API_KEY_MISSING");
  }

  return apiKey;
};

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const pickFirst = (...values) => values.find((value) => value !== null && value !== undefined && value !== "") || "";

const splitDescription = (description = "") => {
  const [mainText = "", ...rest] = String(description).split(",").map((part) => part.trim());
  return {
    mainText,
    secondaryText: rest.join(", "),
  };
};

const splitHouseAndStreet = (name = "") => {
  const text = String(name || "").trim();
  const match = text.match(/^(\d+[A-Za-z0-9/-]*)\s+(.+)$/);

  return {
    houseNumber: match ? match[1] : "",
    street: match ? match[2] : text,
  };
};

const getBoundaryName = (boundaries = [], type) => {
  const boundary = boundaries.find((item) => Number(item.type) === type);
  return pickFirst(boundary?.full_name, [boundary?.prefix, boundary?.name].filter(Boolean).join(" "), boundary?.name);
};

const extractItems = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  return [];
};

const extractPlace = (payload) => {
  if (!payload || Array.isArray(payload)) {
    return null;
  }

  return payload.data || payload.result || payload;
};

const extractFirstItem = (payload) => {
  const items = extractItems(payload);
  if (items.length > 0) {
    return items[0];
  }

  return extractPlace(payload);
};

const requestVietMap = async (url) => {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    throw new VietMapProviderError(
      payload?.message || payload?.error || "VietMap request failed",
      response.status,
      "VIETMAP_REQUEST_FAILED"
    );
  }

  return payload;
};

const toSuggestion = (item) => {
  const description = pickFirst(item.display, item.address, item.name);
  const fallbackParts = splitDescription(description);

  return {
    placeId: String(pickFirst(item.ref_id, item.refId, item.placeId, item.id)),
    description,
    mainText: pickFirst(item.name, fallbackParts.mainText, description),
    secondaryText: pickFirst(item.address, fallbackParts.secondaryText),
    latitude: toNullableNumber(pickFirst(item.lat, item.latitude)),
    longitude: toNullableNumber(pickFirst(item.lng, item.lon, item.longitude)),
    provider: "vietmap",
    raw: item,
  };
};

const toDetail = (placeId, data = {}) => {
  const formattedAddress = pickFirst(data.display, data.address, data.formattedAddress, data.name);
  const streetParts = splitHouseAndStreet(data.name);
  const normalized = normalizeAddress({
    ...data,
    formattedAddress,
    houseNumber: pickFirst(data.hs_num, data.houseNumber, data.house_number),
  });

  return {
    placeId: pickFirst(placeId, data.ref_id, data.refId, data.id),
    formattedAddress,
    latitude: toNullableNumber(pickFirst(data.lat, data.latitude)),
    longitude: toNullableNumber(pickFirst(data.lng, data.lon, data.longitude)),
    province: pickFirst(data.city, data.province, getBoundaryName(data.boundaries, 0), normalized.province),
    district: pickFirst(data.district, getBoundaryName(data.boundaries, 1), normalized.district),
    ward: pickFirst(data.ward, getBoundaryName(data.boundaries, 2), normalized.ward),
    street: pickFirst(data.street, streetParts.street, normalized.street),
    houseNumber: pickFirst(data.hs_num, data.houseNumber, data.house_number, streetParts.houseNumber, normalized.houseNumber),
    provider: "vietmap",
    raw: data,
  };
};

const suggest = async (query) => {
  const q = String(query || "").trim();

  if (q.length < 2) {
    return [];
  }

  const url = new URL(VIETMAP_AUTOCOMPLETE_URL);
  url.searchParams.set("apikey", ensureApiKey());
  url.searchParams.set("text", q);
  url.searchParams.set("display_type", "6");
  url.searchParams.set("focus", DEFAULT_FOCUS);

  const payload = await requestVietMap(url);
  return extractItems(payload)
    .map(toSuggestion)
    .filter((suggestion) => suggestion.placeId && suggestion.description);
};

const detail = async (refId) => {
  const placeId = String(refId || "").trim();

  if (!placeId) {
    throw new VietMapProviderError("placeId is required", 400, "VIETMAP_PLACE_ID_REQUIRED");
  }

  const url = new URL(VIETMAP_PLACE_URL);
  url.searchParams.set("apikey", ensureApiKey());
  url.searchParams.set("refid", placeId);

  const payload = await requestVietMap(url);
  const data = extractPlace(payload);

  if (!data) {
    return null;
  }

  return toDetail(placeId, data);
};

const reverse = async (latitude, longitude) => {
  const lat = toNullableNumber(latitude);
  const lng = toNullableNumber(longitude);

  if (lat === null || lng === null) {
    throw new VietMapProviderError("latitude and longitude are required", 400, "VIETMAP_INVALID_COORDINATES");
  }

  const url = new URL(VIETMAP_REVERSE_URL);
  url.searchParams.set("apikey", ensureApiKey());
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lng", String(lng));
  url.searchParams.set("display_type", "6");

  const payload = await requestVietMap(url);
  const data = extractFirstItem(payload);

  if (!data) {
    return null;
  }

  return toDetail(pickFirst(data.ref_id, `vietmap-reverse:${lat},${lng}`), {
    ...data,
    lat: pickFirst(data.lat, lat),
    lng: pickFirst(data.lng, lng),
  });
};

module.exports = {
  name: "vietmap",
  VietMapProviderError,
  suggest,
  detail,
  reverse,
  getDetail: detail,
  reverseGeocode: reverse,
};
