const addressService = require("./address.service");

const sendError = (res, error) => {
  console.warn(`[address] Unexpected controller error: ${error.message}`);
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
    const data = await addressService.getAddressDetail(req.params.placeId, req.query);
    return res.json(data);
  } catch (error) {
    return sendError(res, error);
  }
};

const reverse = async (req, res) => {
  try {
    const data = await addressService.reverseAddress(req.query.lat, req.query.lng);
    return res.json(data);
  } catch (error) {
    return sendError(res, error);
  }
};

module.exports = {
  suggest,
  detail,
  reverse,
};
