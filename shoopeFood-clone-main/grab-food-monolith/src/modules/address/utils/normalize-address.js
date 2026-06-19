const normalizeText = (value) => String(value || "").trim();

const normalizeSearchText = (value) =>
  normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();

const getComponentText = (component) => {
  if (!component) {
    return "";
  }

  return normalizeText(
    component.longText || component.long_name || component.text || component.shortText || component.short_name || component.name
  );
};

const findComponent = (addressComponents, types) =>
  addressComponents.find((component) => {
    const componentTypes = component.types || [];
    return types.some((type) => componentTypes.includes(type));
  });

const getComponent = (addressComponents, types) => getComponentText(findComponent(addressComponents, types));

const normalizeFromTypedComponents = (addressComponents) => ({
  province: getComponent(addressComponents, ["administrative_area_level_1"]),
  district: getComponent(addressComponents, ["administrative_area_level_2", "locality"]),
  ward: getComponent(addressComponents, ["administrative_area_level_3", "sublocality_level_1", "sublocality"]),
  street: getComponent(addressComponents, ["route"]),
  houseNumber: getComponent(addressComponents, ["street_number", "premise", "subpremise"]),
});

const pickFirst = (...values) => values.map(normalizeText).find(Boolean) || "";

const normalizeFromObject = (rawAddress = {}) => ({
  province: pickFirst(rawAddress.province, rawAddress.city, rawAddress.region, rawAddress.state),
  district: pickFirst(rawAddress.district, rawAddress.county, rawAddress.locality, rawAddress.city_district),
  ward: pickFirst(rawAddress.ward, rawAddress.neighbourhood, rawAddress.neighborhood, rawAddress.suburb, rawAddress.admin_v3),
  street: pickFirst(rawAddress.street, rawAddress.road, rawAddress.route, rawAddress.street_name),
  houseNumber: pickFirst(
    rawAddress.houseNumber,
    rawAddress.house_number,
    rawAddress.housenumber,
    rawAddress.hs_num,
    rawAddress.number
  ),
});

const normalizeFromString = (rawAddress = "") => {
  const parts = String(rawAddress)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const [firstPart = ""] = parts;
  const houseStreetMatch = firstPart.match(/^(\d+[A-Za-z0-9/-]*)\s+(.+)$/);
  const findPart = (pattern) => parts.find((part) => pattern.test(normalizeSearchText(part))) || "";

  return {
    province: findPart(/ho chi minh|ha noi|da nang|tinh|thanh pho|tp\.?/),
    district: findPart(/quan|huyen|thi xa|thu duc|tan binh/),
    ward: findPart(/phuong|xa|thi tran/),
    street: houseStreetMatch ? houseStreetMatch[2] : firstPart,
    houseNumber: houseStreetMatch ? houseStreetMatch[1] : "",
  };
};

const normalizeAddress = (rawAddress = []) => {
  if (Array.isArray(rawAddress)) {
    return normalizeFromTypedComponents(rawAddress);
  }

  if (typeof rawAddress === "string") {
    return normalizeFromString(rawAddress);
  }

  const formattedAddress =
    rawAddress.formattedAddress || rawAddress.formatted_address || rawAddress.label || rawAddress.description || "";

  return {
    ...normalizeFromString(formattedAddress),
    ...Object.fromEntries(Object.entries(normalizeFromObject(rawAddress)).filter(([, value]) => Boolean(value))),
  };
};

module.exports = normalizeAddress;
