<<<<<<< HEAD
const { Restaurant, RestaurantChangeRequest, User } = require("../models");

const APPROVAL_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

const CHANGE_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

const DIRECT_UPDATE_FIELDS = ["openingTime", "closingTime", "isOpen", "isOpenToday", "temporaryClosedReason", "temporaryClosedUntil"];
const APPROVAL_REQUIRED_FIELDS = ["ownerId", "name", "address", "latitude", "longitude", "imageUrl", "ratingAvg"];
=======
const { Restaurant, User } = require("../models");
>>>>>>> origin/main

const normalizeRestaurant = (item) => ({
  id: item.id,
  ownerId: item.ownerId,
  name: item.name,
  address: item.address || "",
  latitude: Number(item.latitude || 0),
  longitude: Number(item.longitude || 0),
<<<<<<< HEAD
  openingTime: item.openingTime || "07:00:00",
  closingTime: item.closingTime || "22:00:00",
  isOpen: Boolean(item.isOpen),
  isOpenToday: item.isOpenToday !== undefined ? Boolean(item.isOpenToday) : true,
  temporaryClosedReason: item.temporaryClosedReason || null,
  temporaryClosedUntil: item.temporaryClosedUntil || null,
  imageUrl: item.imageUrl || null,
  ratingAvg: Number(item.ratingAvg || 0),
  approvalStatus: item.approvalStatus || APPROVAL_STATUS.PENDING,
  approvedBy: item.approvedBy || null,
  approvedAt: item.approvedAt || null,
  rejectReason: item.rejectReason || null,
  deletedAt: item.deletedAt || null,
});

const normalizeChangeRequest = (item) => ({
  id: item.id,
  restaurantId: item.restaurantId,
  requestedBy: item.requestedBy,
  payload: item.payload,
  status: item.status,
  reviewedBy: item.reviewedBy || null,
  reviewedAt: item.reviewedAt || null,
  rejectReason: item.rejectReason || null,
  createdAt: item.created_at || item.createdAt || null,
});

const verifyCoordinates = (latitude, longitude) => {
  if (!Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90) {
    return "latitude must be between -90 and 90";
  }

  if (!Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180) {
    return "longitude must be between -180 and 180";
  }

  return null;
};

const verifyTimes = (openingTime, closingTime) => {
  if (!openingTime || !closingTime) {
    return "openingTime and closingTime are required";
  }

  const timePattern = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
  if (!timePattern.test(String(openingTime)) || !timePattern.test(String(closingTime))) {
    return "openingTime and closingTime must use HH:mm or HH:mm:ss";
  }

  const [h1, m1, s1 = 0] = String(openingTime).split(":").map(Number);
  const [h2, m2, s2 = 0] = String(closingTime).split(":").map(Number);
  const openSeconds = h1 * 3600 + m1 * 60 + s1;
  const closeSeconds = h2 * 3600 + m2 * 60 + s2;

  if (openSeconds >= closeSeconds) {
    return "openingTime must be earlier than closingTime";
  }

  return null;
};

const withError = (res, status, message) => res.status(status).json({ message, error: { message } });
const withSuccess = (res, status, message, data) => res.status(status).json({ message, data, success: { message, data } });

const pickDefined = (source, fields) =>
  fields.reduce((result, field) => {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
    return result;
  }, {});

const normalizeRestaurantPayload = (payload) => {
  const next = { ...payload };

  if (next.ownerId !== undefined) next.ownerId = Number(next.ownerId);
  if (next.name !== undefined) next.name = String(next.name).trim();
  if (next.address !== undefined) next.address = String(next.address).trim();
  if (next.latitude !== undefined) next.latitude = Number(next.latitude);
  if (next.longitude !== undefined) next.longitude = Number(next.longitude);
  if (next.imageUrl !== undefined) next.imageUrl = next.imageUrl ? String(next.imageUrl).trim() : null;
  if (next.ratingAvg !== undefined) next.ratingAvg = Number.isFinite(Number(next.ratingAvg)) ? Number(next.ratingAvg) : undefined;
  if (next.isOpen !== undefined) next.isOpen = Boolean(next.isOpen);
  if (next.isOpenToday !== undefined) next.isOpenToday = Boolean(next.isOpenToday);
  if (next.temporaryClosedReason !== undefined) {
    next.temporaryClosedReason = next.temporaryClosedReason ? String(next.temporaryClosedReason).trim() : null;
  }
  if (next.temporaryClosedUntil !== undefined) {
    next.temporaryClosedUntil = next.temporaryClosedUntil ? new Date(next.temporaryClosedUntil) : null;
  }

  Object.keys(next).forEach((key) => {
    if (next[key] === undefined) {
      delete next[key];
    }
  });

  return next;
};

const validateRestaurantPayload = async (payload, current = {}) => {
  const nextOwnerId = payload.ownerId !== undefined ? Number(payload.ownerId) : current.ownerId;
  if (nextOwnerId !== undefined) {
    const owner = await User.findByPk(nextOwnerId);
    if (!owner) {
      return "ownerId is not valid";
    }
  }

  const nextName = payload.name !== undefined ? payload.name : current.name;
  if (nextName !== undefined && (!nextName || String(nextName).trim().length === 0)) {
    return "name cannot be empty";
  }

  const latitude = payload.latitude !== undefined ? payload.latitude : current.latitude;
  const longitude = payload.longitude !== undefined ? payload.longitude : current.longitude;
  if (latitude !== undefined || longitude !== undefined) {
    const coordError = verifyCoordinates(latitude, longitude);
    if (coordError) {
      return coordError;
    }
  }

  const openingTime = payload.openingTime || current.openingTime;
  const closingTime = payload.closingTime || current.closingTime;
  if (openingTime || closingTime) {
    const timeError = verifyTimes(openingTime, closingTime);
    if (timeError) {
      return timeError;
    }
  }

  return null;
};

exports.listRestaurants = async (req, res) => {
  try {
    const includePending = req.query.includePending === "true";
    const where = includePending
      ? { deletedAt: null }
      : { deletedAt: null, approvalStatus: APPROVAL_STATUS.APPROVED };
    const items = await Restaurant.findAll({ where, order: [["id", "ASC"]] });
    return withSuccess(res, 200, "Restaurants fetched", items.map(normalizeRestaurant));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

exports.listMyRestaurants = async (req, res) => {
  try {
    const ownerId = Number(req.query.ownerId || req.user?.id);
    if (!Number.isFinite(ownerId)) {
      return withError(res, 400, "ownerId is required");
    }

    const items = await Restaurant.findAll({ where: { ownerId, deletedAt: null }, order: [["id", "ASC"]] });
    return withSuccess(res, 200, "My restaurants fetched", items.map(normalizeRestaurant));
  } catch (error) {
    return withError(res, 500, error.message);
=======
  isOpen: Boolean(item.isOpen),
  imageUrl: item.imageUrl || null,
  ratingAvg: Number(item.ratingAvg || 0),
});

exports.listRestaurants = async (req, res) => {
  try {
    const items = await Restaurant.findAll({ order: [["id", "ASC"]] });
    res.json({ data: items.map(normalizeRestaurant) });
  } catch (error) {
    res.status(500).json({ message: error.message });
>>>>>>> origin/main
  }
};

exports.getRestaurantById = async (req, res) => {
  try {
    const id = Number(req.params.id);
<<<<<<< HEAD
    if (!Number.isFinite(id)) {
      return withError(res, 400, "Invalid restaurant id");
    }

    const item = await Restaurant.findOne({ where: { id, deletedAt: null } });
    if (!item) {
      return withError(res, 404, "Restaurant not found");
    }

    return withSuccess(res, 200, "Restaurant fetched", normalizeRestaurant(item));
  } catch (error) {
    return withError(res, 500, error.message);
=======
    const item = await Restaurant.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    return res.json({ data: normalizeRestaurant(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
>>>>>>> origin/main
  }
};

exports.createRestaurant = async (req, res) => {
  try {
<<<<<<< HEAD
    const {
      ownerId,
      name,
      address = "",
      latitude = 0,
      longitude = 0,
      openingTime = "07:00:00",
      closingTime = "22:00:00",
      isOpen = true,
      imageUrl = null,
      ratingAvg = 5.0,
    } = req.body;

    const payload = normalizeRestaurantPayload({
      ownerId,
      name,
      address,
      latitude,
      longitude,
      openingTime,
      closingTime,
      isOpen,
      imageUrl,
      ratingAvg,
    });
    const validationError = await validateRestaurantPayload(payload);
    if (validationError) {
      return withError(res, 400, validationError);
    }

    const newRestaurant = await Restaurant.create({
      ...payload,
      isOpen: false,
      isOpenToday: false,
      approvalStatus: APPROVAL_STATUS.PENDING,
    });

    return withSuccess(res, 201, "Restaurant submitted for approval", normalizeRestaurant(newRestaurant));
  } catch (error) {
    return withError(res, 500, error.message);
=======
    const { name, address, ownerId, latitude = 0, longitude = 0, isOpen = true, imageUrl = null, ratingAvg = 5.0 } = req.body;

    if (!name || !address) {
      return res.status(400).json({ message: "name and address are required" });
    }

    const normalizedOwnerId = Number(ownerId) || 1;
    const owner = await User.findByPk(normalizedOwnerId);
    if (!owner) {
      return res.status(400).json({ message: "owner not found" });
    }

    const newRestaurant = await Restaurant.create({
      ownerId: normalizedOwnerId,
      name: String(name).trim(),
      address: String(address).trim(),
      latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : 0,
      longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : 0,
      isOpen: Boolean(isOpen),
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      ratingAvg: Number.isFinite(Number(ratingAvg)) ? Number(ratingAvg) : 5.0,
    });

    return res.status(201).json({ message: "Created", data: normalizeRestaurant(newRestaurant) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
>>>>>>> origin/main
  }
};

exports.updateRestaurant = async (req, res) => {
  try {
    const id = Number(req.params.id);
<<<<<<< HEAD
    if (!Number.isFinite(id)) {
      return withError(res, 400, "Invalid restaurant id");
    }

    const item = await Restaurant.findOne({ where: { id, deletedAt: null } });
    if (!item) {
      return withError(res, 404, "Restaurant not found");
    }

    const directPayload = normalizeRestaurantPayload(pickDefined(req.body, DIRECT_UPDATE_FIELDS));
    const approvalPayload = normalizeRestaurantPayload(pickDefined(req.body, APPROVAL_REQUIRED_FIELDS));
    const combinedPayload = { ...directPayload, ...approvalPayload };

    if (Object.keys(combinedPayload).length === 0) {
      return withError(res, 400, "No update fields provided");
    }

    const validationError = await validateRestaurantPayload(combinedPayload, item);
    if (validationError) {
      return withError(res, 400, validationError);
    }

    if (Object.keys(directPayload).length > 0) {
      await item.update(directPayload);
    }

    let changeRequest = null;
    if (Object.keys(approvalPayload).length > 0) {
      changeRequest = await RestaurantChangeRequest.create({
        restaurantId: item.id,
        requestedBy: Number(req.body.requestedBy || req.user?.id || item.ownerId),
        payload: approvalPayload,
        status: CHANGE_STATUS.PENDING,
      });
    }

    await item.reload();

    return withSuccess(res, 200, changeRequest ? "Restaurant update submitted for approval" : "Restaurant updated", {
      restaurant: normalizeRestaurant(item),
      changeRequest: changeRequest ? normalizeChangeRequest(changeRequest) : null,
    });
  } catch (error) {
    return withError(res, 500, error.message);
=======
    const { name, address, ownerId, latitude, longitude, isOpen, imageUrl, ratingAvg } = req.body;
    const item = await Restaurant.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    if (!name || !address) {
      return res.status(400).json({ message: "name and address are required" });
    }

    const nextOwnerId = ownerId !== undefined && Number.isFinite(Number(ownerId)) ? Number(ownerId) : item.ownerId;
    if (nextOwnerId !== item.ownerId) {
      const owner = await User.findByPk(nextOwnerId);
      if (!owner) {
        return res.status(400).json({ message: "owner not found" });
      }
    }

    await item.update({
      name: String(name).trim(),
      address: String(address).trim(),
      ownerId: nextOwnerId,
      latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : item.latitude,
      longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : item.longitude,
      isOpen: typeof isOpen === "boolean" ? isOpen : item.isOpen,
      imageUrl: imageUrl !== undefined ? (imageUrl ? String(imageUrl).trim() : null) : item.imageUrl,
      ratingAvg: ratingAvg !== undefined && Number.isFinite(Number(ratingAvg)) ? Number(ratingAvg) : item.ratingAvg,
    });

    return res.json({ message: "Updated", data: normalizeRestaurant(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
>>>>>>> origin/main
  }
};

exports.deleteRestaurant = async (req, res) => {
  try {
    const id = Number(req.params.id);
<<<<<<< HEAD
    if (!Number.isFinite(id)) {
      return withError(res, 400, "Invalid restaurant id");
    }

    const item = await Restaurant.findOne({ where: { id, deletedAt: null } });
    if (!item) {
      return withError(res, 404, "Restaurant not found");
    }

    await item.update({ deletedAt: new Date() });
    return withSuccess(res, 200, "Restaurant deleted", normalizeRestaurant(item));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

exports.patchRestaurantStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isOpen } = req.body;
    if (!Number.isFinite(id)) {
      return withError(res, 400, "Invalid restaurant id");
    }
    if (typeof isOpen !== "boolean") {
      return withError(res, 400, "isOpen must be boolean");
    }

    const item = await Restaurant.findOne({ where: { id, deletedAt: null } });
    if (!item) {
      return withError(res, 404, "Restaurant not found");
    }

    await item.update({ isOpen });
    return withSuccess(res, 200, "Restaurant status updated", normalizeRestaurant(item));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

exports.patchRestaurantTodayStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isOpenToday, reason = null, temporaryClosedUntil = null } = req.body;
    if (!Number.isFinite(id)) {
      return withError(res, 400, "Invalid restaurant id");
    }
    if (typeof isOpenToday !== "boolean") {
      return withError(res, 400, "isOpenToday must be boolean");
    }

    const item = await Restaurant.findOne({ where: { id, deletedAt: null } });
    if (!item) {
      return withError(res, 404, "Restaurant not found");
    }

    await item.update({
      isOpenToday,
      temporaryClosedReason: isOpenToday ? null : reason ? String(reason).trim() : null,
      temporaryClosedUntil: temporaryClosedUntil ? new Date(temporaryClosedUntil) : null,
    });
    return withSuccess(res, 200, "Restaurant today status updated", normalizeRestaurant(item));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

exports.patchRestaurantLocation = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { latitude, longitude } = req.body;
    if (!Number.isFinite(id)) {
      return withError(res, 400, "Invalid restaurant id");
    }

    const coordError = verifyCoordinates(latitude, longitude);
    if (coordError) {
      return withError(res, 400, coordError);
    }

    const item = await Restaurant.findOne({ where: { id, deletedAt: null } });
    if (!item) {
      return withError(res, 404, "Restaurant not found");
    }

    await item.update({ latitude: Number(latitude), longitude: Number(longitude) });
    return withSuccess(res, 200, "Restaurant location updated", normalizeRestaurant(item));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

exports.listPendingRestaurants = async (req, res) => {
  try {
    const items = await Restaurant.findAll({
      where: { deletedAt: null, approvalStatus: APPROVAL_STATUS.PENDING },
      order: [["id", "ASC"]],
    });
    return withSuccess(res, 200, "Pending restaurants fetched", items.map(normalizeRestaurant));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

exports.approveRestaurant = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return withError(res, 400, "Invalid restaurant id");
    }

    const item = await Restaurant.findOne({ where: { id, deletedAt: null } });
    if (!item) {
      return withError(res, 404, "Restaurant not found");
    }

    await item.update({
      approvalStatus: APPROVAL_STATUS.APPROVED,
      approvedBy: Number(req.body.approvedBy || req.user?.id || 1),
      approvedAt: new Date(),
      rejectReason: null,
      isOpen: true,
      isOpenToday: true,
    });

    return withSuccess(res, 200, "Restaurant approved", normalizeRestaurant(item));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

exports.rejectRestaurant = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return withError(res, 400, "Invalid restaurant id");
    }

    const item = await Restaurant.findOne({ where: { id, deletedAt: null } });
    if (!item) {
      return withError(res, 404, "Restaurant not found");
    }

    await item.update({
      approvalStatus: APPROVAL_STATUS.REJECTED,
      approvedBy: null,
      approvedAt: null,
      rejectReason: req.body.reason ? String(req.body.reason).trim() : "Rejected by admin",
      isOpen: false,
      isOpenToday: false,
    });

    return withSuccess(res, 200, "Restaurant rejected", normalizeRestaurant(item));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

exports.listChangeRequests = async (req, res) => {
  try {
    const status = req.query.status || CHANGE_STATUS.PENDING;
    const items = await RestaurantChangeRequest.findAll({ where: { status }, order: [["id", "ASC"]] });
    return withSuccess(res, 200, "Restaurant change requests fetched", items.map(normalizeChangeRequest));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

exports.approveChangeRequest = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return withError(res, 400, "Invalid change request id");
    }

    const changeRequest = await RestaurantChangeRequest.findByPk(id);
    if (!changeRequest) {
      return withError(res, 404, "Change request not found");
    }
    if (changeRequest.status !== CHANGE_STATUS.PENDING) {
      return withError(res, 400, "Change request already reviewed");
    }

    const restaurant = await Restaurant.findOne({ where: { id: changeRequest.restaurantId, deletedAt: null } });
    if (!restaurant) {
      return withError(res, 404, "Restaurant not found");
    }

    const payload = normalizeRestaurantPayload(changeRequest.payload || {});
    const validationError = await validateRestaurantPayload(payload, restaurant);
    if (validationError) {
      return withError(res, 400, validationError);
    }

    await restaurant.update(payload);
    await changeRequest.update({
      status: CHANGE_STATUS.APPROVED,
      reviewedBy: Number(req.body.reviewedBy || req.user?.id || 1),
      reviewedAt: new Date(),
      rejectReason: null,
    });

    return withSuccess(res, 200, "Change request approved", {
      restaurant: normalizeRestaurant(restaurant),
      changeRequest: normalizeChangeRequest(changeRequest),
    });
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

exports.rejectChangeRequest = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return withError(res, 400, "Invalid change request id");
    }

    const changeRequest = await RestaurantChangeRequest.findByPk(id);
    if (!changeRequest) {
      return withError(res, 404, "Change request not found");
    }
    if (changeRequest.status !== CHANGE_STATUS.PENDING) {
      return withError(res, 400, "Change request already reviewed");
    }

    await changeRequest.update({
      status: CHANGE_STATUS.REJECTED,
      reviewedBy: Number(req.body.reviewedBy || req.user?.id || 1),
      reviewedAt: new Date(),
      rejectReason: req.body.reason ? String(req.body.reason).trim() : "Rejected by admin",
    });

    return withSuccess(res, 200, "Change request rejected", normalizeChangeRequest(changeRequest));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

exports.verifyCoordinates = verifyCoordinates;
exports.verifyTimes = verifyTimes;
=======
    const item = await Restaurant.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    await item.destroy();
    return res.json({ message: "Deleted", data: normalizeRestaurant(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
>>>>>>> origin/main
