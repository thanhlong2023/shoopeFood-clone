const getComponentText = (component) => {
  if (!component) {
    return "";
  }

  return component.longText || component.long_name || component.text || component.shortText || component.short_name || "";
};

const findComponent = (addressComponents, types) =>
  addressComponents.find((component) => {
    const componentTypes = component.types || [];
    return types.some((type) => componentTypes.includes(type));
  });

const getComponent = (addressComponents, types) => getComponentText(findComponent(addressComponents, types));

const normalizeAddress = (addressComponents = []) => ({
  province: getComponent(addressComponents, ["administrative_area_level_1"]),
  district: getComponent(addressComponents, ["administrative_area_level_2", "locality"]),
  ward: getComponent(addressComponents, ["administrative_area_level_3", "sublocality_level_1", "sublocality"]),
  street: getComponent(addressComponents, ["route"]),
  houseNumber: getComponent(addressComponents, ["street_number", "premise", "subpremise"]),
});

module.exports = normalizeAddress;
