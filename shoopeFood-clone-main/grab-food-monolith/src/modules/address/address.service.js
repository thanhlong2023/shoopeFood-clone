const googlePlaceProvider = require("./providers/google-place.provider");
const normalizeAddress = require("./utils/normalize-address");

const suggestAddresses = async (keyword) => {
  const q = String(keyword || "").trim();

  if (q.length < 2) {
    return [];
  }

  return googlePlaceProvider.suggest(q);
};

const getAddressDetail = async (placeId) => {
  const place = await googlePlaceProvider.getDetail(placeId);
  const normalizedAddress = normalizeAddress(place.addressComponents || []);
  const latitude = Number(place.location?.latitude);
  const longitude = Number(place.location?.longitude);

  return {
    placeId: place.id || String(placeId || ""),
    name: place.displayName?.text || place.name || "",
    formattedAddress: place.formattedAddress || "",
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    ...normalizedAddress,
  };
};

module.exports = {
  suggestAddresses,
  getAddressDetail,
};
