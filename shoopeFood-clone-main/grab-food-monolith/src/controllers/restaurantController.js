const { Restaurant, RestaurantChangeRequest, User, Role } = require("../models");
const { assignMerchantRole } = require("../utils/roleAssignment");
const { Op } = require("sequelize");
const { resolveUserRoles } = require("../utils/roleResolver");

// ==== HELPER FUNCTIONS ====

const normalizeRestaurant = (item) => ({
  id: item.id,
  ownerId: item.ownerId,
  name: item.name,
  address: item.address || "",
  latitude: Number(item.latitude || 0),
  longitude: Number(item.longitude || 0),
  openingTime: item.openingTime || "07:00:00",
  closingTime: item.closingTime || "22:00:00",
  isOpen: Boolean(item.isOpen),
  isOpenToday: Boolean(item.isOpenToday),
  temporaryClosedReason: item.temporaryClosedReason || null,
  temporaryClosedUntil: item.temporaryClosedUntil || null,
  imageUrl: item.imageUrl || null,
  ratingAvg: Number(item.ratingAvg || 5.0),
  approvalStatus: item.approvalStatus || "PENDING",
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
  createdAt: item.createdAt || null,
});

const verifyCoordinates = (lat, lng) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { valid: false, error: "Coordinates must be numbers" };
  }
  if (latitude < -90 || latitude > 90) {
    return { valid: false, error: "Latitude must be between -90 and 90" };
  }
  if (longitude < -180 || longitude > 180) {
    return { valid: false, error: "Longitude must be between -180 and 180" };
  }
  return { valid: true, latitude, longitude };
};

const verifyTimes = (openingTime, closingTime) => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
  if (!timeRegex.test(openingTime)) {
    return { valid: false, error: "Invalid openingTime format (HH:mm or HH:mm:ss)" };
  }
  if (!timeRegex.test(closingTime)) {
    return { valid: false, error: "Invalid closingTime format (HH:mm or HH:mm:ss)" };
  }
  const open = openingTime.split(":").slice(0, 2).join(":");
  const close = closingTime.split(":").slice(0, 2).join(":");
  if (open >= close) {
    return { valid: false, error: "closingTime must be after openingTime" };
  }
  return { valid: true };
};

const pickDefined = (obj, fields) => {
  const result = {};
  fields.forEach((field) => {
    if (obj.hasOwnProperty(field) && obj[field] !== undefined) {
      result[field] = obj[field];
    }
  });
  return result;
};

const withError = (res, status, msg) => {
  res.status(status).json({ message: msg, error: { message: msg } });
};

const withSuccess = (res, status, msg, data) => {
  res.status(status).json({ message: msg, success: { message: msg, data }, data });
};

const merchantRoleInclude = {
  model: Role,
  as: "roles",
  where: { name: "MERCHANT" },
  required: true,
  through: { attributes: [] },
  attributes: ["id", "name"],
};

const findMerchantById = async (userId) => {
  const merchantUser = await User.findOne({
    where: { id: userId },
    include: [merchantRoleInclude],
  });

  if (merchantUser) {
    return merchantUser;
  }

  const user = await User.findByPk(userId);
  if (!user) {
    return null;
  }

  const ownsRestaurant = await Restaurant.findOne({
    where: { ownerId: userId, deletedAt: null },
    attributes: ["id"],
  });

  return ownsRestaurant ? user : null;
};

// ==== PUBLIC ENDPOINTS ====

/**
 * 1. List restaurants (public)
 * Query: includePending (true/false)
 */
exports.listRestaurants = async (req, res) => {
  try {
    const { includePending } = req.query;
    const where = { deletedAt: null };
    if (includePending !== "true") {
      where.approvalStatus = "APPROVED";
    }
    const items = await Restaurant.findAll({ where, order: [["id", "ASC"]] });
    return withSuccess(res, 200, "Restaurants fetched", items.map(normalizeRestaurant));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

/**
 * 2. Get restaurant by ID
 */
exports.getRestaurantById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await Restaurant.findOne({
      where: { id, deletedAt: null },
    });

    if (!item) {
      return withError(res, 404, "Restaurant not found");
    }

    return withSuccess(res, 200, "Restaurant fetched", normalizeRestaurant(item));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

/**
 * 3. List my restaurants (merchant)
 */
exports.listMyRestaurants = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return withError(res, 401, "User not authenticated");
    }

    const items = await Restaurant.findAll({
      where: { ownerId, deletedAt: null },
      order: [["id", "ASC"]],
    });

    return withSuccess(res, 200, "My restaurants fetched", items.map(normalizeRestaurant));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

// ==== CRUD ENDPOINTS ====

/**
 * 4. Create restaurant (status=PENDING)
 */
exports.createRestaurant = async (req, res) => {
  try {
    const {
      ownerId,
      name,
      address,
      latitude = 0,
      longitude = 0,
      openingTime = "07:00:00",
      closingTime = "22:00:00",
      isOpen = true,
      imageUrl = null,
      ratingAvg = 5.0,
    } = req.body;

    const { hasRole } = await resolveUserRoles(req);
    const isAdmin = hasRole(["ADMIN"]);
    const isMerchant = hasRole(["MERCHANT"]);
    let normalizedOwnerId;
    let approvalStatus = "PENDING";
    let approvedBy = null;
    let approvedAt = null;

    if (isAdmin) {
      normalizedOwnerId = Number(ownerId);
      if (!Number.isFinite(normalizedOwnerId) || normalizedOwnerId <= 0) {
        return withError(res, 400, "ownerId of a MERCHANT user is required");
      }

      const merchantOwner = await findMerchantById(normalizedOwnerId);
      if (!merchantOwner) {
        return withError(res, 400, "Owner must be an existing MERCHANT user");
      }

      approvalStatus = "APPROVED";
      approvedBy = req.user?.id || null;
      approvedAt = new Date();
    } else if (isMerchant) {
      normalizedOwnerId = Number(req.user?.id);
      if (!Number.isFinite(normalizedOwnerId)) {
        return withError(res, 401, "User not authenticated");
      }
      approvalStatus = "PENDING";
    } else {
      return withError(res, 403, "Only ADMIN or MERCHANT can create restaurants");
    }

    if (!name) {
      return withError(res, 400, "name is required");
    }

    // Verify coordinates
    const coordCheck = verifyCoordinates(latitude, longitude);
    if (!coordCheck.valid) {
      return withError(res, 400, coordCheck.error);
    }

    // Verify times
    const timeCheck = verifyTimes(openingTime, closingTime);
    if (!timeCheck.valid) {
      return withError(res, 400, timeCheck.error);
    }

    const newRestaurant = await Restaurant.create({
      ownerId: normalizedOwnerId,
      name: String(name).trim(),
      address: String(address || "").trim(),
      latitude: coordCheck.latitude,
      longitude: coordCheck.longitude,
      openingTime: openingTime.trim(),
      closingTime: closingTime.trim(),
      isOpen: Boolean(isOpen),
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      ratingAvg: Number.isFinite(Number(ratingAvg)) ? Number(ratingAvg) : 5.0,
      approvalStatus,
      approvedBy,
      approvedAt,
    });

    return withSuccess(res, 201, "Restaurant created", normalizeRestaurant(newRestaurant));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

/**
 * 5. Update restaurant (direct + approval-required fields)
 * Direct: openingTime, closingTime, isOpen, isOpenToday, temporaryClosedReason, temporaryClosedUntil
 * Approval: ownerId, name, address, latitude, longitude, imageUrl, ratingAvg
 */
exports.updateRestaurant = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await Restaurant.findOne({ where: { id, deletedAt: null } });

    if (!item) {
      return withError(res, 404, "Restaurant not found");
    }

    // Fields that don't require approval
    const directFields = ["openingTime", "closingTime", "isOpen", "isOpenToday", "temporaryClosedReason", "temporaryClosedUntil"];
    // Fields that require approval
    const approvalFields = ["ownerId", "name", "address", "latitude", "longitude", "imageUrl", "ratingAvg"];

    const directUpdates = pickDefined(req.body, directFields);
    const approvalUpdates = pickDefined(req.body, approvalFields);

    // Apply direct updates
    if (Object.keys(directUpdates).length > 0) {
      // Validate times if provided
      if (directUpdates.openingTime || directUpdates.closingTime) {
        const opening = directUpdates.openingTime || item.openingTime;
        const closing = directUpdates.closingTime || item.closingTime;
        const timeCheck = verifyTimes(opening, closing);
        if (!timeCheck.valid) {
          return withError(res, 400, timeCheck.error);
        }
      }
      await item.update(directUpdates);
    }

    const { hasRole } = await resolveUserRoles(req);
    const isAdmin = hasRole(["ADMIN"]);
    const isMerchantOwner =
      hasRole(["MERCHANT"]) && Number(item.ownerId) === Number(req.user?.id);

    if (!isAdmin && !isMerchantOwner) {
      return withError(res, 403, "Not allowed to update this restaurant");
    }

    // Merchant owner can update restaurant image immediately
    if (isMerchantOwner && !isAdmin && approvalUpdates.imageUrl !== undefined) {
      const imageUrl = approvalUpdates.imageUrl
        ? String(approvalUpdates.imageUrl).trim()
        : null;
      await item.update({ imageUrl });
      delete approvalUpdates.imageUrl;
    }

    // Handle approval-required updates
    let changeRequest = null;
    if (Object.keys(approvalUpdates).length > 0) {
      if (approvalUpdates.ownerId) {
        const newOwnerId = Number(approvalUpdates.ownerId);
        if (!Number.isFinite(newOwnerId)) {
          return withError(res, 400, "ownerId must be a number");
        }
        const owner = await findMerchantById(newOwnerId);
        if (!owner) {
          return withError(res, 400, "New owner must be a MERCHANT user");
        }
        approvalUpdates.ownerId = newOwnerId;
      }

      if (approvalUpdates.latitude !== undefined || approvalUpdates.longitude !== undefined) {
        const lat = approvalUpdates.latitude !== undefined ? approvalUpdates.latitude : item.latitude;
        const lng = approvalUpdates.longitude !== undefined ? approvalUpdates.longitude : item.longitude;
        const coordCheck = verifyCoordinates(lat, lng);
        if (!coordCheck.valid) {
          return withError(res, 400, coordCheck.error);
        }
      }

      if (approvalUpdates.imageUrl !== undefined) {
        approvalUpdates.imageUrl = approvalUpdates.imageUrl
          ? String(approvalUpdates.imageUrl).trim()
          : null;
      }

      if (isAdmin) {
        await item.update(approvalUpdates);
      } else {
        changeRequest = await RestaurantChangeRequest.create({
          restaurantId: id,
          requestedBy: req.user?.id || item.ownerId,
          payload: approvalUpdates,
          status: "PENDING",
        });
      }
    }

    await item.reload();

    return withSuccess(res, 200, "Restaurant updated", {
      restaurant: normalizeRestaurant(item),
      changeRequest: changeRequest ? normalizeChangeRequest(changeRequest) : null,
    });
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

/**
 * 6. Delete restaurant (soft delete)
 */
exports.deleteRestaurant = async (req, res) => {
  try {
    const id = Number(req.params.id);
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

// ==== STATUS ENDPOINTS ====

/**
 * 7. Patch restaurant status (mở/đóng toàn ngày)
 */
exports.patchRestaurantStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isOpen } = req.body;

    const item = await Restaurant.findOne({ where: { id, deletedAt: null } });
    if (!item) {
      return withError(res, 404, "Restaurant not found");
    }

    if (isOpen !== undefined) {
      await item.update({ isOpen: Boolean(isOpen) });
    }

    return withSuccess(res, 200, "Status updated", normalizeRestaurant(item));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

/**
 * 8. Patch restaurant today status (mở/đóng hôm nay + lý do)
 */
exports.patchRestaurantTodayStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isOpenToday, reason, temporaryClosedUntil } = req.body;

    const item = await Restaurant.findOne({ where: { id, deletedAt: null } });
    if (!item) {
      return withError(res, 404, "Restaurant not found");
    }

    const updates = {};
    if (isOpenToday !== undefined) {
      updates.isOpenToday = Boolean(isOpenToday);
    }
    if (reason !== undefined) {
      updates.temporaryClosedReason = reason ? String(reason).trim() : null;
    }
    if (temporaryClosedUntil !== undefined) {
      updates.temporaryClosedUntil = temporaryClosedUntil ? new Date(temporaryClosedUntil) : null;
    }

    if (Object.keys(updates).length > 0) {
      await item.update(updates);
    }

    return withSuccess(res, 200, "Today status updated", normalizeRestaurant(item));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

/**
 * 9. Patch restaurant location
 */
exports.patchRestaurantLocation = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { latitude, longitude } = req.body;

    const item = await Restaurant.findOne({ where: { id, deletedAt: null } });
    if (!item) {
      return withError(res, 404, "Restaurant not found");
    }

    if (latitude === undefined || longitude === undefined) {
      return withError(res, 400, "latitude and longitude are required");
    }

    const coordCheck = verifyCoordinates(latitude, longitude);
    if (!coordCheck.valid) {
      return withError(res, 400, coordCheck.error);
    }

    await item.update({
      latitude: coordCheck.latitude,
      longitude: coordCheck.longitude,
    });

    return withSuccess(res, 200, "Location updated", normalizeRestaurant(item));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

// ==== ADMIN ENDPOINTS ====

/**
 * 10. List pending restaurants (admin only)
 */
exports.listPendingRestaurants = async (req, res) => {
  try {
    const items = await Restaurant.findAll({
      where: { approvalStatus: "PENDING", deletedAt: null },
      order: [["id", "ASC"]],
    });

    return withSuccess(res, 200, "Pending restaurants fetched", items.map(normalizeRestaurant));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

/**
 * 11. Approve restaurant (admin only)
 */
exports.approveRestaurant = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { approvedBy } = req.body;

    const item = await Restaurant.findOne({ where: { id, deletedAt: null } });
    if (!item) {
      return withError(res, 404, "Restaurant not found");
    }

    if (item.approvalStatus !== "PENDING") {
      return withError(res, 400, `Restaurant is already ${item.approvalStatus}`);
    }

    await item.update({
      approvalStatus: "APPROVED",
      approvedBy: approvedBy || req.user?.id,
      approvedAt: new Date(),
      isOpen: true,
      isOpenToday: true,
    });

    await assignMerchantRole(item.ownerId);

    return withSuccess(res, 200, "Restaurant approved", normalizeRestaurant(item));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

/**
 * 12. Reject restaurant (admin only)
 */
exports.rejectRestaurant = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { reason } = req.body;

    const item = await Restaurant.findOne({ where: { id, deletedAt: null } });
    if (!item) {
      return withError(res, 404, "Restaurant not found");
    }

    if (item.approvalStatus !== "PENDING") {
      return withError(res, 400, `Restaurant is already ${item.approvalStatus}`);
    }

    await item.update({
      approvalStatus: "REJECTED",
      rejectReason: reason ? String(reason).trim() : null,
      isOpen: false,
      isOpenToday: false,
    });

    return withSuccess(res, 200, "Restaurant rejected", normalizeRestaurant(item));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

// ==== CHANGE REQUEST ENDPOINTS ====

/**
 * 13. List change requests (admin only)
 */
exports.listChangeRequests = async (req, res) => {
  try {
    const { status = "PENDING" } = req.query;
    const where = {};
    if (status) {
      where.status = status;
    }

    const items = await RestaurantChangeRequest.findAll({
      where,
      order: [["id", "DESC"]],
    });

    return withSuccess(res, 200, "Change requests fetched", items.map(normalizeChangeRequest));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

/**
 * 14. Approve change request (admin only)
 */
exports.approveChangeRequest = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { reviewedBy } = req.body;

    const item = await RestaurantChangeRequest.findByPk(id);
    if (!item) {
      return withError(res, 404, "Change request not found");
    }

    if (item.status !== "PENDING") {
      return withError(res, 400, `Change request is already ${item.status}`);
    }

    // Get restaurant and apply changes
    const restaurant = await Restaurant.findByPk(item.restaurantId);
    if (!restaurant) {
      return withError(res, 404, "Associated restaurant not found");
    }

    // Apply payload changes to restaurant
    await restaurant.update(item.payload);

    // Update change request
    await item.update({
      status: "APPROVED",
      reviewedBy: reviewedBy || req.user?.id,
      reviewedAt: new Date(),
    });

    return withSuccess(res, 200, "Change request approved", {
      changeRequest: normalizeChangeRequest(item),
      restaurant: normalizeRestaurant(restaurant),
    });
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

/**
 * 15. Reject change request (admin only)
 */
exports.rejectChangeRequest = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { reason } = req.body;

    const item = await RestaurantChangeRequest.findByPk(id);
    if (!item) {
      return withError(res, 404, "Change request not found");
    }

    if (item.status !== "PENDING") {
      return withError(res, 400, `Change request is already ${item.status}`);
    }

    await item.update({
      status: "REJECTED",
      rejectReason: reason ? String(reason).trim() : null,
    });

    return withSuccess(res, 200, "Change request rejected", normalizeChangeRequest(item));
  } catch (error) {
    return withError(res, 500, error.message);
  }
};
