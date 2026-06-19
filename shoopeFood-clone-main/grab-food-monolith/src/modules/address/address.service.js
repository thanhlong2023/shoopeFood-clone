const normalizeAddress = require("./utils/normalize-address");
const vietmapProvider = require("./providers/vietmap.provider");
const mockAddressProvider = require("./providers/mock-address.provider");

const suggestionCache = new Map();
const MAX_CACHE_SIZE = 250;

const getConfiguredProvider = () => {
  const providerName = String(process.env.ADDRESS_PROVIDER || "vietmap").toLowerCase();

  if (providerName === "mock") {
    return mockAddressProvider;
  }

  return vietmapProvider;
};

const rememberSuggestions = (suggestions) => {
  suggestions.forEach((suggestion) => {
    if (!suggestion?.placeId) {
      return;
    }

    suggestionCache.set(suggestion.placeId, suggestion);
  });

  while (suggestionCache.size > MAX_CACHE_SIZE) {
    const firstKey = suggestionCache.keys().next().value;
    suggestionCache.delete(firstKey);
  }
};

const isMissingVietMapApiKey = (error) => error?.code === "VIETMAP_API_KEY_MISSING";

const warnProviderFailure = (operation, error) => {
  console.warn(`[address] VietMap ${operation} failed: ${error.message}`);
};

const warnMissingVietMapApiKey = () => {
  console.warn("VIETMAP_API_KEY is not configured. Using mock address provider.");
};

const toEmptyDetail = (placeId) => ({
  placeId: String(placeId || ""),
  formattedAddress: "",
  latitude: null,
  longitude: null,
  ...normalizeAddress(""),
  provider: "vietmap",
  raw: {},
});

const toCoordinateOnlyDetail = (latitude, longitude) => ({
  placeId: `current-location:${latitude},${longitude}`,
  formattedAddress: "",
  latitude,
  longitude,
  ...normalizeAddress(""),
  provider: "gps",
  raw: {},
});

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const suggestionToDetail = (suggestion) => ({
  placeId: suggestion.placeId,
  formattedAddress: suggestion.description || "",
  latitude: toNullableNumber(suggestion.latitude),
  longitude: toNullableNumber(suggestion.longitude),
  ...normalizeAddress(suggestion.raw || suggestion.raw?.properties || suggestion.description || ""),
  provider: suggestion.provider || "vietmap",
  raw: suggestion.raw || {},
});

const queryToSuggestion = (placeId, query = {}) => {
  if (!query.description) {
    return null;
  }

  return {
    placeId,
    description: String(query.description || ""),
    latitude: toNullableNumber(query.latitude),
    longitude: toNullableNumber(query.longitude),
    provider: query.provider || "vietmap",
    raw: {},
  };
};

const suggestAddresses = async (keyword) => {
  const q = String(keyword || "").trim();

  if (q.length < 2) {
    return [];
  }

  const provider = getConfiguredProvider();

  try {
    const suggestions = await provider.suggest(q);
    rememberSuggestions(suggestions);
    return suggestions;
  } catch (error) {
    if (isMissingVietMapApiKey(error)) {
      warnMissingVietMapApiKey();
      const fallbackSuggestions = await mockAddressProvider.suggest(q);
      rememberSuggestions(fallbackSuggestions);
      return fallbackSuggestions;
    }

    warnProviderFailure("suggest", error);
    return [];
  }
};

const getAddressDetail = async (placeId, fallbackQuery = {}) => {
  const id = String(placeId || "").trim();

  if (!id) {
    return toEmptyDetail(id);
  }

  const provider = getConfiguredProvider();

  try {
    const detail = await provider.getDetail(id);
    if (detail) {
      return detail;
    }
  } catch (error) {
    if (isMissingVietMapApiKey(error)) {
      warnMissingVietMapApiKey();
      const fallbackDetail = await mockAddressProvider.getDetail(id);
      if (fallbackDetail) {
        return fallbackDetail;
      }
    } else {
      warnProviderFailure("detail", error);
    }
  }

  if (provider === mockAddressProvider) {
    const fallbackDetail = await mockAddressProvider.getDetail(id);
    if (fallbackDetail) {
      return fallbackDetail;
    }
  }

  const cachedSuggestion = suggestionCache.get(id);
  if (cachedSuggestion) {
    return suggestionToDetail(cachedSuggestion);
  }

  const fallbackSuggestion = queryToSuggestion(id, fallbackQuery);
  if (fallbackSuggestion) {
    return suggestionToDetail(fallbackSuggestion);
  }

  return toEmptyDetail(id);
};

const reverseAddress = async (latitude, longitude) => {
  const lat = toNullableNumber(latitude);
  const lng = toNullableNumber(longitude);

  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return toCoordinateOnlyDetail(null, null);
  }

  const provider = getConfiguredProvider();

  try {
    const detail = await provider.reverse(lat, lng);
    if (detail) {
      return detail;
    }
  } catch (error) {
    if (isMissingVietMapApiKey(error)) {
      warnMissingVietMapApiKey();
    } else {
      warnProviderFailure("reverse", error);
    }
  }

  if (provider === mockAddressProvider) {
    const fallbackDetail = await mockAddressProvider.reverse(lat, lng);
    if (fallbackDetail) {
      return fallbackDetail;
    }
  }

  return toCoordinateOnlyDetail(lat, lng);
};

module.exports = {
  suggestAddresses,
  getAddressDetail,
  reverseAddress,
};
