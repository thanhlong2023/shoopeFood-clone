const { Op } = require("sequelize");
const { DriverDetail, DriverLocation, Order, OrderStatus, User, sequelize } = require("../models");
const socketManager = require("../sockets");
const orderRepository = require("../repositories/orderRepository");
const { normalizeOrder } = require("../utils/orderNormalizer");
const { setUserRole } = require("../utils/roleAssignment");
const osrmService = require("../services/osrmService");

const DRIVER_AVAILABLE_STATUS_CODE = "CONFIRMED";
const COMPLETED_STATUS_CODE = "COMPLETED";
const DRIVER_ACTIVE_STATUS_CODES = ["DRIVER_ACCEPTED", "CONFIRMED", "PICKING_UP", "DELIVERING"];
const DRIVER_PROFILE_DELIVERY_LIMIT = 10;
const DRIVER_FEED_COMPLETED_LIMIT = 20;

const normalizeDriver = (item) => {
  const user = item.driverUser || item.User || null;

  return {
    id: item.userId,
    fullName: user ? user.fullName || "" : "",
    phone: user ? user.phone || "" : "",
    ratingAvg: Number(user ? user.ratingAvg || 0 : 0),
    vehicleType: item.vehicleType || "",
    licensePlate: item.licensePlate || "",
    isOnline: Boolean(item.isOnline),
    createdAt: user ? user.createdAt : null,
  };
};

const driverInclude = [{ model: User, as: "driverUser", attributes: ["id", "fullName", "phone", "ratingAvg", "createdAt"] }];

const normalizeDriverLocation = (item) => ({
  id: item.id,
  driverId: item.driverId,
  orderId: item.orderId,
  latitude: Number(item.latitude || 0),
  longitude: Number(item.longitude || 0),
  heading: Number(item.heading || 0),
  speedKmh: Number(item.speedKmh || 0),
  createdAt: item.createdAt,
});

const findApprovedDriver = (driverId, options = {}) =>
  DriverDetail.findOne({
    where: { userId: driverId, approvalStatus: "APPROVED" },
    include: driverInclude,
    ...options,
  });

exports.getDrivers = async (req, res) => {
  try {
    const items = await DriverDetail.findAll({ include: driverInclude, order: [["userId", "ASC"]] });
    return res.json({ data: items.map(normalizeDriver) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getDriverById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await DriverDetail.findOne({ where: { userId: id }, include: driverInclude });

    if (!item) {
      return res.status(404).json({ message: "Driver not found" });
    }

    return res.json({ data: normalizeDriver(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getDriverInfo = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await DriverDetail.findOne({ where: { userId: id }, include: driverInclude });

    if (!item) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const normalized = normalizeDriver(item);
    return res.json({
      data: {
        driverId: normalized.id,
        fullName: normalized.fullName,
        phone: normalized.phone,
        vehicleType: normalized.vehicleType,
        licensePlate: normalized.licensePlate,
        ratingAvg: normalized.ratingAvg,
        isOnline: normalized.isOnline,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getDriverProfile = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid driver id" });
    }

    const item = await findApprovedDriver(id);
    if (!item) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const completedStatus = await OrderStatus.findOne({ where: { code: COMPLETED_STATUS_CODE } });
    const completedWhere = completedStatus
      ? { driverId: id, statusId: completedStatus.id }
      : { driverId: id, id: -1 };

    const [completedCount, completedOrders] = await Promise.all([
      Order.count({ where: completedWhere }),
      Order.findAll({
        where: completedWhere,
        include: orderRepository.getIncludes(),
        order: [["created_at", "DESC"]],
        limit: DRIVER_PROFILE_DELIVERY_LIMIT,
      }),
    ]);

    return res.json({
      data: {
        driver: normalizeDriver(item),
        completedCount,
        completedDeliveries: completedOrders.map((order) => {
          const payload = normalizeOrder(order);
          return {
            id: payload.id,
            orderCode: payload.orderCode,
            restaurantName: payload.restaurant?.name || `Quan #${payload.restaurantId}`,
            totalAmount: payload.totalAmount,
            receiverAddress: payload.receiverAddress,
            completedAt: payload.createdAt,
          };
        }),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getMyOrderFeed = async (req, res) => {
  try {
    const driverId = Number(req.user?.id);
    if (!Number.isFinite(driverId) || req.user.role !== "DRIVER") {
      return res.status(403).json({ message: "Only DRIVER accounts can view driver feed" });
    }

    const driver = await findApprovedDriver(driverId);
    if (!driver) {
      return res.status(403).json({ message: "Driver account is not approved" });
    }

    const statuses = await OrderStatus.findAll({
      where: { code: { [Op.in]: [DRIVER_AVAILABLE_STATUS_CODE, ...DRIVER_ACTIVE_STATUS_CODES] } },
    });
    const statusIdByCode = new Map(statuses.map((status) => [status.code, status.id]));
    const availableStatusId = statusIdByCode.get(DRIVER_AVAILABLE_STATUS_CODE);
    const activeStatusIds = DRIVER_ACTIVE_STATUS_CODES.map((code) => statusIdByCode.get(code)).filter(Boolean);

    const completedStatus = await OrderStatus.findOne({ where: { code: COMPLETED_STATUS_CODE } });
    const completedWhere = completedStatus
      ? { driverId, statusId: completedStatus.id }
      : { driverId, id: -1 };

    const [availableOrders, myOrders, completedOrders] = await Promise.all([
      availableStatusId
        ? Order.findAll({
            where: { driverId: null, statusId: availableStatusId },
            include: orderRepository.getIncludes(),
            order: [["created_at", "DESC"]],
          })
        : Promise.resolve([]),
      activeStatusIds.length > 0
        ? Order.findAll({
            where: { driverId, statusId: { [Op.in]: activeStatusIds } },
            include: orderRepository.getIncludes(),
            order: [["created_at", "DESC"]],
          })
        : Promise.resolve([]),
      Order.findAll({
        where: completedWhere,
        include: orderRepository.getIncludes(),
        order: [["created_at", "DESC"]],
        limit: DRIVER_FEED_COMPLETED_LIMIT,
      }),
    ]);

    return res.json({
      data: {
        driver: normalizeDriver(driver),
        available: availableOrders.map(normalizeOrder),
        active: myOrders.map(normalizeOrder),
        completed: completedOrders.map(normalizeOrder),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getDrivingRoute = async (req, res) => {
  try {
    if (req.user?.role !== "DRIVER") {
      return res.status(403).json({ message: "Only DRIVER accounts can request driving routes" });
    }

    const fromLat = Number(req.query.fromLat);
    const fromLng = Number(req.query.fromLng);
    const toLat = Number(req.query.toLat);
    const toLng = Number(req.query.toLng);

    if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
      return res.status(400).json({ message: "fromLat, fromLng, toLat and toLng are required" });
    }

    const route = await osrmService.getRoute(
      { latitude: fromLat, longitude: fromLng },
      { latitude: toLat, longitude: toLng },
    );

    return res.json({
      data: {
        ok: route.ok,
        geometry: route.geometry || [],
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        error: route.error || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createDriver = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      fullName,
      phone,
      password = "123456",
      ratingAvg = 5.0,
      vehicleType = "",
      licensePlate = "",
      isOnline = false,
    } = req.body;

    if (!fullName || !phone) {
      await transaction.rollback();
      return res.status(400).json({ message: "fullName and phone are required" });
    }

    const normalizedPhone = String(phone).trim();
    const existedUser = await User.findOne({ where: { phone: normalizedPhone }, transaction });
    if (existedUser) {
      await transaction.rollback();
      return res.status(409).json({ message: "Phone already exists" });
    }

    const newUser = await User.create(
      {
        fullName: String(fullName).trim(),
        phone: normalizedPhone,
        password: String(password).trim() || "123456",
        ratingAvg: Number.isFinite(Number(ratingAvg)) ? Number(ratingAvg) : 5.0,
      },
      { transaction }
    );

    const newDriver = await DriverDetail.create(
      {
        userId: newUser.id,
        vehicleType: String(vehicleType || "").trim(),
        licensePlate: String(licensePlate || "").trim(),
        approvalStatus: "APPROVED",
        isOnline: Boolean(isOnline),
      },
      { transaction }
    );

    await setUserRole(newUser.id, "DRIVER", { transaction });

    await transaction.commit();

    const created = await DriverDetail.findOne({ where: { userId: newDriver.userId }, include: driverInclude });
    return res.status(201).json({ message: "Created", data: normalizeDriver(created || newDriver) });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ message: error.message });
  }
};

exports.updateDriver = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const id = Number(req.params.id);
    const { fullName, phone, password, ratingAvg, vehicleType, licensePlate, isOnline } = req.body;

    const item = await DriverDetail.findOne({ where: { userId: id }, include: driverInclude, transaction, lock: true });
    if (!item || !item.driverUser) {
      await transaction.rollback();
      return res.status(404).json({ message: "Driver not found" });
    }

    const user = item.driverUser;

    if (phone !== undefined) {
      const normalizedPhone = String(phone).trim();
      if (!normalizedPhone) {
        await transaction.rollback();
        return res.status(400).json({ message: "phone cannot be empty" });
      }

      if (normalizedPhone !== user.phone) {
        const existedPhone = await User.findOne({ where: { phone: normalizedPhone }, transaction });
        if (existedPhone) {
          await transaction.rollback();
          return res.status(409).json({ message: "Phone already exists" });
        }
      }

      user.phone = normalizedPhone;
    }

    if (fullName !== undefined) {
      user.fullName = String(fullName).trim();
    }

    if (password !== undefined) {
      user.password = String(password).trim();
    }

    if (ratingAvg !== undefined) {
      if (!Number.isFinite(Number(ratingAvg))) {
        await transaction.rollback();
        return res.status(400).json({ message: "ratingAvg must be a number" });
      }
      user.ratingAvg = Number(ratingAvg);
    }

    if (vehicleType !== undefined) {
      item.vehicleType = String(vehicleType).trim();
    }

    if (licensePlate !== undefined) {
      item.licensePlate = String(licensePlate).trim();
    }

    if (isOnline !== undefined) {
      item.isOnline = Boolean(isOnline);
    }

    await Promise.all([user.save({ transaction }), item.save({ transaction })]);
    await transaction.commit();

    const updated = await DriverDetail.findOne({ where: { userId: id }, include: driverInclude });
    return res.json({ message: "Updated", data: normalizeDriver(updated || item) });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteDriver = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const id = Number(req.params.id);
    const item = await DriverDetail.findOne({ where: { userId: id }, include: driverInclude, transaction, lock: true });

    if (!item) {
      await transaction.rollback();
      return res.status(404).json({ message: "Driver not found" });
    }

    const user = await User.findByPk(id, { transaction, lock: true });
    if (user) {
      await user.destroy({ transaction });
    } else {
      await item.destroy({ transaction });
    }

    await transaction.commit();
    return res.json({ message: "Deleted", data: normalizeDriver(item) });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ message: error.message });
  }
};

exports.updateDriverOnlineStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isOnline } = req.body;

    if (typeof isOnline !== "boolean") {
      return res.status(400).json({ message: "isOnline must be boolean" });
    }

    if (!req.user || (req.user.role !== "DRIVER" && req.user.role !== "ADMIN")) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (req.user.role === "DRIVER" && Number(req.user.id) !== id) {
      return res.status(403).json({ message: "Drivers can only update their own status" });
    }

    const item = await DriverDetail.findOne({ where: { userId: id }, include: driverInclude });
    if (!item) {
      return res.status(404).json({ message: "Driver not found" });
    }

    await item.update({ isOnline });
    return res.json({ message: "Updated", data: normalizeDriver(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.setDriverOnline = async (req, res) => {
  req.body.isOnline = true;
  return exports.updateDriverOnlineStatus(req, res);
};

exports.setDriverOffline = async (req, res) => {
  req.body.isOnline = false;
  return exports.updateDriverOnlineStatus(req, res);
};

exports.updateDriverLocation = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { orderId, latitude, longitude, heading = 0, speedKmh = 24 } = req.body;

    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid driver id" });
    }

    if (!req.user || (req.user.role !== "DRIVER" && req.user.role !== "ADMIN")) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (req.user.role === "DRIVER" && Number(req.user.id) !== id) {
      return res.status(403).json({ message: "Drivers can only update their own location" });
    }

    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return res.status(400).json({ message: "latitude and longitude are required" });
    }

    const driver = await DriverDetail.findOne({ where: { userId: id }, include: driverInclude });
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    if (driver.approvalStatus !== "APPROVED") {
      return res.status(403).json({ message: "Driver account is not approved" });
    }

    let normalizedOrderId = null;
    if (orderId !== undefined && orderId !== null && orderId !== "") {
      normalizedOrderId = Number(orderId);
      if (!Number.isFinite(normalizedOrderId)) {
        return res.status(400).json({ message: "Invalid orderId" });
      }

      const order = await Order.findByPk(normalizedOrderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (Number(order.driverId) !== id) {
        return res.status(403).json({ message: "Order is not assigned to this driver" });
      }
    }

    if (!driver.isOnline) {
      await driver.update({ isOnline: true });
    }

    const location = await DriverLocation.create({
      driverId: id,
      orderId: normalizedOrderId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      heading: Number.isFinite(Number(heading)) ? Number(heading) : 0,
      speedKmh: Number.isFinite(Number(speedKmh)) ? Number(speedKmh) : 24,
    });

    const data = normalizeDriverLocation(location);

    try {
      socketManager.getIO().emit("driver:location", data);
      if (normalizedOrderId) {
        socketManager.getIO().emit(`order:${normalizedOrderId}:driver-location`, data);
      }
    } catch (error) {
      console.log("Socket not ready or err", error.message);
    }

    return res.status(201).json({ message: "Updated", data });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getLatestDriverLocation = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { orderId } = req.query;
    const whereClause = { driverId: id };

    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid driver id" });
    }

    if (orderId !== undefined) {
      const normalizedOrderId = Number(orderId);
      if (!Number.isFinite(normalizedOrderId)) {
        return res.status(400).json({ message: "Invalid orderId" });
      }
      whereClause.orderId = normalizedOrderId;
    }

    const item = await DriverLocation.findOne({
      where: whereClause,
      order: [["created_at", "DESC"]],
    });

    if (!item) {
      return res.status(404).json({ message: "Driver location not found" });
    }

    return res.json({ data: normalizeDriverLocation(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
