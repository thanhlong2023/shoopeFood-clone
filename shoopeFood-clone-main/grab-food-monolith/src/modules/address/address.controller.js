const addressService = require("./address.service");
const { GooglePlaceProviderError } = require("./providers/google-place.provider");

const sendError = (res, error) => {
  if (error instanceof GooglePlaceProviderError) {
    return res.status(error.status || 500).json({ message: error.message });
  }

  return res.status(500).json({ message: "Unable to resolve address" });
};

const suggest = async (req, res) => {
  try {
    const data = await addressService.suggestAddresses(req.query.q);
    return res.json(data);
  } catch (error) {
    return sendError(res, error);
  }
};

const detail = async (req, res) => {
  try {
    const data = await addressService.getAddressDetail(req.params.placeId);
    return res.json(data);
  } catch (error) {
    return sendError(res, error);
  }
};

module.exports = {
  suggest,
  detail,
};
