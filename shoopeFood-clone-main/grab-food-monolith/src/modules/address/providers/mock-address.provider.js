const normalizeAddress = require("../utils/normalize-address");

const mockAddresses = [
  {
    placeId: "mock-nguyen-trai-q5",
    description: "413 Nguyen Trai, Phuong 7, Quan 5, TP. Ho Chi Minh, Viet Nam",
    mainText: "413 Nguyen Trai",
    secondaryText: "Phuong 7, Quan 5, TP. Ho Chi Minh",
    latitude: 10.7554,
    longitude: 106.6669,
  },
  {
    placeId: "mock-le-van-sy-pn",
    description: "84 Le Van Sy, Phuong 10, Phu Nhuan, TP. Ho Chi Minh, Viet Nam",
    mainText: "84 Le Van Sy",
    secondaryText: "Phuong 10, Phu Nhuan, TP. Ho Chi Minh",
    latitude: 10.7936,
    longitude: 106.6749,
  },
  {
    placeId: "mock-tran-hung-dao-q1",
    description: "Tran Hung Dao, Cau Ong Lanh, Quan 1, TP. Ho Chi Minh, Viet Nam",
    mainText: "Tran Hung Dao",
    secondaryText: "Cau Ong Lanh, Quan 1, TP. Ho Chi Minh",
    latitude: 10.7642,
    longitude: 106.6957,
  },
  {
    placeId: "mock-quan-1",
    description: "Quan 1, TP. Ho Chi Minh, Viet Nam",
    mainText: "Quan 1",
    secondaryText: "TP. Ho Chi Minh",
    latitude: 10.7756,
    longitude: 106.7019,
  },
  {
    placeId: "mock-tan-binh",
    description: "Tan Binh, TP. Ho Chi Minh, Viet Nam",
    mainText: "Tan Binh",
    secondaryText: "TP. Ho Chi Minh",
    latitude: 10.8016,
    longitude: 106.6526,
  },
  {
    placeId: "mock-man-thien-38",
    description: "38 Man Thien, Phuong Tang Nhon Phu A, TP Thu Duc, TP. Ho Chi Minh, Viet Nam",
    mainText: "38 Man Thien",
    secondaryText: "Tang Nhon Phu A, TP Thu Duc, TP. Ho Chi Minh",
    latitude: 10.8428,
    longitude: 106.7786,
  },
];

const normalizeSearchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase()
    .trim();

const toSuggestion = (item) => ({
  ...item,
  provider: "mock",
  raw: { source: "mock-address.provider", ...item },
});

const calculateDistanceKm = (fromLat, fromLng, toLat, toLng) => {
  const earthRadiusKm = 6371;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const suggest = async (keyword) => {
  const query = normalizeSearchText(keyword);

  if (query.length < 2) {
    return [];
  }

  return mockAddresses
    .filter((item) =>
      [item.description, item.mainText, item.secondaryText].some((value) => normalizeSearchText(value).includes(query))
    )
    .map(toSuggestion);
};

const getDetail = async (placeId) => {
  const item = mockAddresses.find((address) => address.placeId === placeId);

  if (!item) {
    return null;
  }

  return {
    placeId: item.placeId,
    formattedAddress: item.description,
    latitude: item.latitude,
    longitude: item.longitude,
    ...normalizeAddress(item.description),
    provider: "mock",
    raw: { source: "mock-address.provider", ...item },
  };
};

const reverse = async (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const nearest = mockAddresses
    .map((address) => ({
      ...address,
      distanceKm: calculateDistanceKm(lat, lng, address.latitude, address.longitude),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];

  if (!nearest || nearest.distanceKm > 1) {
    return null;
  }

  return getDetail(nearest.placeId);
};

module.exports = {
  name: "mock",
  suggest,
  getDetail,
  reverse,
  reverseGeocode: reverse,
};
