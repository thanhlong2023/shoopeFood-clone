const shippingService = require("../services/shippingService");
const { sequelize, User, DriverDetail, DriverLocation, Restaurant, OrderStatus, Food, Category, OrderItem } = require("../models");
const orderRepository = require("../repositories/orderRepository");
const orderFactory = require("../factories/orderFactory");
const socketManager = require("../sockets");

const DEFAULT_SHIPPING_BASE_FEE = 20000;
const DEFAULT_ORDER_STATUS_CODE = orderFactory.DEFAULT_ORDER_STATUS_CODE;

const getBaseFeeFromOrder = (order) => {
  if (order.subtotalAmount !== undefined && order.subtotalAmount !== null) {
    return Number(order.subtotalAmount || 0);
  }
  return Math.max(0, Number(order.totalAmount || 0) - Number(order.shippingFee || 0));
};

const normalizeOrderItem = (item) => ({
  id: item.id,
  orderId: item.orderId,
  foodId: item.foodId,
  foodName: item.foodName || (item.food ? item.food.name : null),
  quantity: Number(item.quantity || 0),
  priceAtOrder: Number(item.priceAtOrder || 0),
  lineTotal: Number(item.quantity || 0) * Number(item.priceAtOrder || 0),
});

const normalizeOrder = (item) => ({
  id: item.id,
  orderCode: item.orderCode,
  idempotencyKey: item.idempotencyKey,
  customer: item.customerUser ? item.customerUser.fullName || `User ${item.customerId}` : `User ${item.customerId}`,
  customerId: item.customerId,
  restaurantId: item.restaurantId,
  driverId: item.driverId,
  voucherId: item.voucherId,
  receiverAddress: item.receiverAddress || "",
  receiverLat: item.receiverLat,
  receiverLng: item.receiverLng,
  distanceKm: Number(item.distanceKm || 0),
  baseFee: getBaseFeeFromOrder(item),
  subtotalAmount: Number(item.subtotalAmount || 0),
  taxAmount: Number(item.taxAmount || 0),
  discountAmount: Number(item.discountAmount || 0),
  totalAmount: Number(item.totalAmount || 0),
  shippingFee: Number(item.shippingFee || 0),
  statusId: item.statusId,
  statusCode: item.statusInfo ? item.statusInfo.code : null,
  status: item.statusInfo ? item.statusInfo.code : null,
  statusLabel: item.statusInfo ? item.statusInfo.label : null,
  paymentMethod: item.payment ? item.payment.paymentMethod : null,
  paymentStatus: item.payment ? item.payment.status : null,
  items: item.items ? item.items.map(normalizeOrderItem) : [],
  version: item.version,
  createdAt: item.createdAt,
});

const resolveStatusByCode = async (statusCode = DEFAULT_ORDER_STATUS_CODE) => {
  const normalizedCode = orderFactory.resolveStatusCode(statusCode);
  const status = await OrderStatus.findOne({ where: { code: normalizedCode } });
  if (!status) {
    return null;
  }
  return status;
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeRequestedOrderItems = (items) => {
  if (items === undefined) {
    return { hasItems: false, items: [] };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: "items must be a non-empty array" };
  }

  const itemMap = new Map();
  for (const item of items) {
    const foodId = Number(item.foodId);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(foodId) || foodId <= 0) {
      return { error: "items.foodId must be a positive integer" };
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: "items.quantity must be a positive integer" };
    }

    itemMap.set(foodId, (itemMap.get(foodId) || 0) + quantity);
  }

  return {
    hasItems: true,
    items: Array.from(itemMap.entries()).map(([foodId, quantity]) => ({ foodId, quantity })),
  };
};

const normalizeRestaurantForTracking = (item) => {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    address: item.address || "",
    latitude: Number(item.latitude || 0),
    longitude: Number(item.longitude || 0),
    isOpen: Boolean(item.isOpen),
  };
};

const normalizeDriverForTracking = (item) => {
  if (!item) {
    return null;
  }

  return {
    id: item.userId,
    fullName: item.driverUser ? item.driverUser.fullName || "" : "",
    phone: item.driverUser ? item.driverUser.phone || "" : "",
    vehicleType: item.vehicleType || "",
    licensePlate: item.licensePlate || "",
    isOnline: Boolean(item.isOnline),
  };
};

const normalizeDriverLocation = (item) => {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    driverId: item.driverId,
    orderId: item.orderId,
    latitude: Number(item.latitude || 0),
    longitude: Number(item.longitude || 0),
    heading: Number(item.heading || 0),
    speedKmh: Number(item.speedKmh || 0),
    createdAt: item.createdAt,
  };
};

const buildRoutePoints = (from, to, steps = 40) => {
  const points = [];
  const fromLat = Number(from.latitude || 0);
  const fromLng = Number(from.longitude || 0);
  const toLat = Number(to.latitude || 0);
  const toLng = Number(to.longitude || 0);

  for (let index = 0; index <= steps; index += 1) {
    const ratio = index / steps;
    const curve = Math.sin(ratio * Math.PI) * 0.0025;
    points.push({
      latitude: fromLat + (toLat - fromLat) * ratio + curve,
      longitude: fromLng + (toLng - fromLng) * ratio - curve * 0.65,
    });
  }

  return points;
};

const calculateRouteProgress = (location, routePoints = []) => {
  if (!location || routePoints.length === 0) {
    return 0;
  }

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  routePoints.forEach((point, index) => {
    const distance = Math.hypot(point.latitude - location.latitude, point.longitude - location.longitude);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return Math.round((nearestIndex / Math.max(routePoints.length - 1, 1)) * 100);
};

exports.createOrder = async (req, res) => {
  try {
    const {
      customerId,
      restaurantId,
      driverId,
      voucherId,
      receiverAddress = "",
      receiverLat,
      receiverLng,
      distanceKm = 2,
      baseFee = DEFAULT_SHIPPING_BASE_FEE,
      discountAmount = 0,
      taxAmount = 0,
      statusCode = DEFAULT_ORDER_STATUS_CODE,
      shippingType = "STANDARD",
      orderCode,
      idempotencyKey,
      items,
    } = req.body;

    const requestedItems = normalizeRequestedOrderItems(items);
    if (requestedItems.error) {
      return res.status(400).json({ message: requestedItems.error });
    }

    if (!Number.isFinite(Number(customerId)) || !Number.isFinite(Number(restaurantId))) {
      return res.status(400).json({ message: "customerId and restaurantId are required" });
    }

    if (!Number.isFinite(Number(receiverLat)) || !Number.isFinite(Number(receiverLng))) {
      return res.status(400).json({ message: "receiverLat and receiverLng are required" });
    }

    if (!Number.isFinite(Number(distanceKm))) {
      return res.status(400).json({ message: "distanceKm must be a number" });
    }

    if (!Number.isFinite(Number(baseFee))) {
      return res.status(400).json({ message: "baseFee must be a number" });
    }

    if (!Number.isFinite(Number(discountAmount))) {
      return res.status(400).json({ message: "discountAmount must be a number" });
    }

    if (!Number.isFinite(Number(taxAmount))) {
      return res.status(400).json({ message: "taxAmount must be a number" });
    }

    const [user, restaurant] = await Promise.all([
      User.findByPk(Number(customerId)),
      Restaurant.findByPk(Number(restaurantId)),
    ]);

    if (!user || !restaurant) {
      return res.status(400).json({ message: "customer or restaurant not found" });
    }

    if (!restaurant.isOpen) {
      return res.status(400).json({ message: "restaurant is closed" });
    }

    const normalizedDistance = Number(distanceKm);
    const fallbackSubtotal = Number(baseFee);
    const normalizedDiscount = Number(discountAmount);
    const normalizedTax = Number(taxAmount);

    const [statusInfo, duplicated] = await Promise.all([
      resolveStatusByCode(statusCode),
      idempotencyKey
        ? orderRepository.findByIdempotencyKey(idempotencyKey)
        : Promise.resolve(null),
    ]);

    if (!statusInfo) {
      return res.status(400).json({ message: "Invalid statusCode" });
    }

    if (duplicated) {
      return res.status(200).json({ message: "Duplicated idempotency key", data: normalizeOrder(duplicated) });
    }

    let createdOrderId = null;

    await sequelize.transaction(async (transaction) => {
      await Food.resetExpiredDailyQuantities({ transaction });

      let normalizedSubtotal = fallbackSubtotal;
      const preparedOrderItems = [];

      if (requestedItems.hasItems) {
        normalizedSubtotal = 0;

        for (const requestedItem of requestedItems.items) {
          const food = await Food.findByPk(requestedItem.foodId, {
            include: [{ model: Category, as: "category", attributes: ["id", "restaurantId"] }],
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          if (!food || !food.category || Number(food.category.restaurantId) !== restaurant.id) {
            throw createHttpError(400, `Food #${requestedItem.foodId} is not in this restaurant menu`);
          }

          if (!food.isAvailable) {
            throw createHttpError(400, `${food.name} is not available`);
          }

          const availableQuantity = Number(food.currentQuantity || 0);
          if (availableQuantity < requestedItem.quantity) {
            throw createHttpError(409, `${food.name} only has ${availableQuantity} item(s) left today`);
          }

          const priceAtOrder = Number(food.price || 0);
          normalizedSubtotal += priceAtOrder * requestedItem.quantity;
          food.currentQuantity = availableQuantity - requestedItem.quantity;

          await food.save({ transaction });

          preparedOrderItems.push({
            foodId: food.id,
            foodName: food.name,
            quantity: requestedItem.quantity,
            priceAtOrder,
          });
        }
      }

      const shippingFee = shippingService.calculateShippingFee(normalizedDistance, normalizedSubtotal, shippingType);
      const totalAmount = Math.max(0, normalizedSubtotal + shippingFee + normalizedTax - normalizedDiscount);

      const orderPayload = orderFactory.buildCreatePayload({
        orderCode,
        idempotencyKey,
        customerId: user.id,
        restaurantId: restaurant.id,
        driverId,
        voucherId,
        receiverAddress,
        receiverLat,
        receiverLng,
        distanceKm: normalizedDistance,
        subtotalAmount: normalizedSubtotal,
        taxAmount: normalizedTax,
        totalAmount,
        shippingFee,
        discountAmount: normalizedDiscount,
        statusId: statusInfo.id,
      });

      const newOrder = await orderRepository.create(orderPayload, { transaction });

      if (preparedOrderItems.length > 0) {
        await OrderItem.bulkCreate(
          preparedOrderItems.map((item) => ({
            ...item,
            orderId: newOrder.id,
          })),
          { transaction }
        );
      }

      createdOrderId = newOrder.id;
    });

    const created = await orderRepository.findById(createdOrderId);
    const orderData = normalizeOrder(created);

    // Emit event realtime
    try {
      socketManager.getIO().emit("new_order", orderData);
    } catch(e) {
      console.log("Socket not ready or err", e.message);
    }

    return res.status(201).json({
      message: "Created",
      data: orderData,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const filters = {};
    if (req.query.statusId) filters.statusId = Number(req.query.statusId);
    else if (req.query.statusCode) {
      const resolvedStatus = await resolveStatusByCode(req.query.statusCode);
      if (resolvedStatus) filters.statusId = resolvedStatus.id;
    }
    if (req.query.restaurantId) filters.restaurantId = Number(req.query.restaurantId);
    if (req.query.customerId) filters.customerId = Number(req.query.customerId);
    if (req.query.driverId) filters.driverId = Number(req.query.driverId);
    if (req.query.fromDate) filters.fromDate = new Date(req.query.fromDate);
    if (req.query.toDate) filters.toDate = new Date(req.query.toDate);

    const items = await orderRepository.findAll(filters);
    return res.json({ data: items.map(normalizeOrder) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await orderRepository.findById(id);

    if (!item) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.json({ data: normalizeOrder(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getOrderTracking = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await orderRepository.findById(id);

    if (!item) {
      return res.status(404).json({ message: "Order not found" });
    }

    const orderData = normalizeOrder(item);

    const [restaurant, driver, latestLocation] = await Promise.all([
      Restaurant.findByPk(orderData.restaurantId),
      orderData.driverId
        ? DriverDetail.findOne({
            where: { userId: orderData.driverId },
            include: [{ model: User, as: "driverUser", attributes: ["id", "fullName", "phone", "ratingAvg"] }],
          })
        : Promise.resolve(null),
      orderData.driverId
        ? DriverLocation.findOne({
            where: { driverId: orderData.driverId, orderId: orderData.id },
            order: [["created_at", "DESC"]],
          })
        : Promise.resolve(null),
    ]);

    const restaurantData = normalizeRestaurantForTracking(restaurant);
    const destination = {
      latitude: Number(orderData.receiverLat || restaurantData?.latitude || 0),
      longitude: Number(orderData.receiverLng || restaurantData?.longitude || 0),
    };
    const routePoints = restaurantData ? buildRoutePoints(restaurantData, destination) : [];
    const locationData =
      normalizeDriverLocation(latestLocation) ||
      (restaurantData && orderData.driverId
        ? {
            id: null,
            driverId: orderData.driverId,
            orderId: orderData.id,
            latitude: restaurantData.latitude,
            longitude: restaurantData.longitude,
            heading: 0,
            speedKmh: 0,
            createdAt: null,
          }
        : null);

    return res.json({
      data: {
        order: orderData,
        restaurant: restaurantData,
        driver: normalizeDriverForTracking(driver),
        driverLocation: locationData,
        destination,
        routePoints,
        routeProgress: calculateRouteProgress(locationData, routePoints),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await orderRepository.findEntityById(id);

    if (!item) {
      return res.status(404).json({ message: "Order not found" });
    }

    const {
      customerId,
      restaurantId,
      receiverAddress,
      receiverLat,
      receiverLng,
      distanceKm,
      baseFee,
      status,
      statusCode,
      discountAmount,
      taxAmount,
      shippingType = "STANDARD",
      driverId,
      voucherId,
      expectedVersion,
    } = req.body;

    if (expectedVersion !== undefined && Number(expectedVersion) !== Number(item.version)) {
      return res.status(409).json({ message: "Version conflict" });
    }

    if (customerId !== undefined) {
      const user = await User.findByPk(Number(customerId));
      if (!user) {
        return res.status(400).json({ message: "customer not found" });
      }
      item.customerId = Number(customerId);
    }

    if (restaurantId !== undefined) {
      const restaurant = await Restaurant.findByPk(Number(restaurantId));
      if (!restaurant) {
        return res.status(400).json({ message: "restaurant not found" });
      }
      item.restaurantId = Number(restaurantId);
    }

    if (receiverAddress !== undefined) {
      item.receiverAddress = String(receiverAddress).trim();
    }

    if (receiverLat !== undefined) {
      if (!Number.isFinite(Number(receiverLat))) {
        return res.status(400).json({ message: "receiverLat must be a number" });
      }
      item.receiverLat = Number(receiverLat);
    }

    if (receiverLng !== undefined) {
      if (!Number.isFinite(Number(receiverLng))) {
        return res.status(400).json({ message: "receiverLng must be a number" });
      }
      item.receiverLng = Number(receiverLng);
    }

    if (distanceKm !== undefined) {
      if (!Number.isFinite(Number(distanceKm))) {
        return res.status(400).json({ message: "distanceKm must be a number" });
      }
      item.distanceKm = Number(distanceKm);
    }

    if (driverId !== undefined) {
      item.driverId = Number.isFinite(Number(driverId)) ? Number(driverId) : null;
    }

    if (voucherId !== undefined) {
      item.voucherId = Number.isFinite(Number(voucherId)) ? Number(voucherId) : null;
    }

    const incomingStatusCode = statusCode !== undefined ? statusCode : status;
    if (incomingStatusCode !== undefined) {
      const resolvedStatus = await resolveStatusByCode(incomingStatusCode);
      if (!resolvedStatus) {
        return res.status(400).json({ message: "Invalid statusCode" });
      }
      item.statusId = resolvedStatus.id;
    }

    if (baseFee !== undefined && !Number.isFinite(Number(baseFee))) {
      return res.status(400).json({ message: "baseFee must be a number" });
    }

    if (discountAmount !== undefined && !Number.isFinite(Number(discountAmount))) {
      return res.status(400).json({ message: "discountAmount must be a number" });
    }

    if (taxAmount !== undefined && !Number.isFinite(Number(taxAmount))) {
      return res.status(400).json({ message: "taxAmount must be a number" });
    }

    const nextBaseFee = baseFee !== undefined ? Number(baseFee) : getBaseFeeFromOrder(item) || DEFAULT_SHIPPING_BASE_FEE;
    const normalizedDistance = Number(item.distanceKm || 0);
    const nextDiscount = discountAmount !== undefined ? Number(discountAmount) : Number(item.discountAmount || 0);
    const nextTax = taxAmount !== undefined ? Number(taxAmount) : Number(item.taxAmount || 0);

    item.shippingFee = shippingService.calculateShippingFee(normalizedDistance, nextBaseFee, shippingType);
    item.subtotalAmount = nextBaseFee;
    item.discountAmount = nextDiscount;
    item.taxAmount = nextTax;
    item.totalAmount = nextBaseFee + Number(item.shippingFee || 0) + nextTax - nextDiscount;
    item.version = Number(item.version || 0) + 1;

    const latest = await orderRepository.save(item);
    const orderData = normalizeOrder(latest || item);

    try {
      socketManager.getIO().emit("order:updated", orderData);
      socketManager.getIO().emit(`order:${orderData.id}:updated`, orderData);
    } catch (error) {
      console.log("Socket not ready or err", error.message);
    }

    return res.json({ message: "Updated", data: orderData });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, statusCode, expectedVersion } = req.body;

    const [item, resolvedStatus] = await Promise.all([
      orderRepository.findEntityById(id),
      resolveStatusByCode(statusCode !== undefined ? statusCode : status),
    ]);

    if (!item) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!resolvedStatus) {
      return res.status(400).json({ message: "Invalid statusCode" });
    }

    if (expectedVersion !== undefined && Number(expectedVersion) !== Number(item.version)) {
      return res.status(409).json({ message: "Version conflict" });
    }

    const latest = await orderRepository.update(item, {
      statusId: resolvedStatus.id,
      version: Number(item.version || 0) + 1,
    });
    const orderData = normalizeOrder(latest);

    try {
      socketManager.getIO().emit("order:updated", orderData);
      socketManager.getIO().emit(`order:${orderData.id}:updated`, orderData);
    } catch (error) {
      console.log("Socket not ready or err", error.message);
    }

    return res.json({
      message: "Updated",
      data: orderData,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await orderRepository.findEntityById(id);

    if (!item) {
      return res.status(404).json({ message: "Order not found" });
    }

    const deleted = await orderRepository.delete(item);
    return res.json({ message: "Deleted", data: deleted });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getOrdersPage = (req, res) => {
  return orderRepository
    .findAll()
    .then((items) => {
      res.render("orders", {
        orders: items.map(normalizeOrder),
      });
    })
    .catch(() => {
      res.render("orders", {
        orders: [],
      });
    });
};
