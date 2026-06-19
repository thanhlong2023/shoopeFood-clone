const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";
const AUTOCOMPLETE_FIELD_MASK =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text";
const DETAILS_FIELD_MASK = "id,name,displayName,formattedAddress,location,addressComponents";

class GooglePlaceProviderError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "GooglePlaceProviderError";
    this.status = status;
  }
}

const getApiKey = () => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new GooglePlaceProviderError("GOOGLE_MAPS_API_KEY is not configured", 500);
  }

  return apiKey;
};

const requestGooglePlaces = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getApiKey(),
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.error?.message || "Google Places request failed";
    throw new GooglePlaceProviderError(message, response.status);
  }

  return payload;
};

const splitDescription = (description) => {
  const [mainText = "", ...rest] = String(description || "").split(",");
  return {
    mainText: mainText.trim(),
    secondaryText: rest.join(",").trim(),
  };
};

const mapSuggestion = (suggestion) => {
  const prediction = suggestion.placePrediction;
  if (!prediction?.placeId) {
    return null;
  }

  const description = prediction.text?.text || "";
  const fallback = splitDescription(description);

  return {
    placeId: prediction.placeId,
    description,
    mainText: prediction.structuredFormat?.mainText?.text || fallback.mainText || description,
    secondaryText: prediction.structuredFormat?.secondaryText?.text || fallback.secondaryText,
  };
};

const suggest = async (keyword) => {
  const input = String(keyword || "").trim();

  if (input.length < 2) {
    return [];
  }

  const payload = await requestGooglePlaces(`${GOOGLE_PLACES_BASE_URL}/places:autocomplete`, {
    method: "POST",
    headers: {
      "X-Goog-FieldMask": AUTOCOMPLETE_FIELD_MASK,
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ["vn"],
      languageCode: "vi",
    }),
  });

  return (payload.suggestions || []).map(mapSuggestion).filter(Boolean);
};

const getDetail = async (placeId) => {
  const id = String(placeId || "").trim();

  if (!id) {
    throw new GooglePlaceProviderError("placeId is required", 400);
  }

  const detailUrl = new URL(`${GOOGLE_PLACES_BASE_URL}/places/${encodeURIComponent(id)}`);
  detailUrl.searchParams.set("languageCode", "vi");
  detailUrl.searchParams.set("regionCode", "vn");

  return requestGooglePlaces(detailUrl.toString(), {
    method: "GET",
    headers: {
      "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    },
  });
};

module.exports = {
  GooglePlaceProviderError,
  suggest,
  getDetail,
};
