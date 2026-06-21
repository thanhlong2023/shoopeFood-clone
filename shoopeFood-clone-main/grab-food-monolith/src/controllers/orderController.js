const { Op } = require("sequelize");
const shippingService = require("../services/shippingService");
const osrmService = require("../services/osrmService");
const {
  sequelize,
  User,
  DriverDetail,
  DriverLocation,
  Restaurant,
  Order,
  OrderStatus,
  Food,
  Category,
  OrderItem,
  Review,
  Topping,
  OrderItemTopping,
} = require("../models");
const orderRepository = require("../repositories/orderRepository");
const orderFactory = require("../factories/orderFactory");
const socketManager = require("../sockets");
const dispatchService = require("../services/dispatchService");
const driverService = require("../services/driverService");
const locationStreamService = require("../services/locationStreamService");
const orderWorkflowService = require("../services/orderWorkflowService");
const { getBaseFeeFromOrder, normalizeOrder, normalizeRestaurantSummary } = require("../utils/orderNormalizer");

const DEFAULT_SHIPPING_BASE_FEE = 20000;
const DEFAULT_ORDER_STATUS_CODE = orderFactory.DEFAULT_ORDER_STATUS_CODE;
const DRIVER_ACTIVE_STATUS_CODES = new Set(orderWorkflowService.DRIVER_ACTIVE_STATUS_CODES);
const MAX_DRIVER_ACCEPT_RADIUS_KM = 10;

const resolveStatusByCode = async (statusCode = DEFAULT_ORDER_STATUS_CODE, options = {}) => {
  const normalizedCode = orderFactory.resolveStatusCode(statusCode);
  const status = await OrderStatus.findOne({ where: { code: normalizedCode }, ...options });
  return status || null;
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
    const toppings = Array.isArray(item.toppings) 
      ? item.toppings
          .filter(t => t && Number.isInteger(Number(t.id)) && Number.isInteger(Number(t.quantity)) && Number(t.quantity) > 0)
          .map(t => ({ id: Number(t.id), quantity: Number(t.quantity) }))
          .sort((a, b) => a.id - b.id) 
      : [];
    const itemKey = `${foodId}-${toppings.map(t => `${t.id}x${t.quantity}`).join(',')}`;

    if (!Number.isInteger(foodId) || foodId <= 0) {
      return { error: "items.foodId must be a positive integer" };
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: "items.quantity must be a positive integer" };
    }

    if (!itemMap.has(itemKey)) {
      itemMap.set(itemKey, { foodId, quantity: 0, toppings });
    }
    itemMap.get(itemKey).quantity += quantity;
  }

  return {
    hasItems: true,
    items: Array.from(itemMap.values()),
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
    geohash: item.geohash || null,
    heading: Number(item.heading || 0),
    speedKmh: Number(item.speedKmh || 0),
    createdAt: item.createdAt,
  };
};

const toRoutePoint = (point) => ({
  latitude: Number(point?.latitude ?? point?.lat ?? 0),
  longitude: Number(point?.longitude ?? point?.lng ?? 0),
});

const hasValidRoutePoint = (point) =>
  Number.isFinite(Number(point?.latitude)) &&
  Number.isFinite(Number(point?.longitude)) &&
  Math.abs(Number(point.latitude)) <= 90 &&
  Math.abs(Number(point.longitude)) <= 180;

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

const buildRouteLeg = async ({ key, label, from, to }) => {
  if (!hasValidRoutePoint(from) || !hasValidRoutePoint(to)) {
    return {
      key,
      label,
      from,
      to,
      provider: "OSRM",
      ok: false,
      distanceKm: 0,
      durationMinutes: 0,
      geometry: [],
      steps: [],
      error: "Missing coordinates",
    };
  }

  const route = await osrmService.getRoute(from, to);
  return {
    key,
    label,
    from,
    to,
    provider: route.provider,
    ok: route.ok,
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    geometry: route.geometry,
    steps: route.steps,
    error: route.error,
  };
};

const buildTrackingRoute = async ({ driverLocation, restaurant, destination }) => {
  const routeLegs = [];

  if (driverLocation && restaurant) {
    routeLegs.push(
      await buildRouteLeg({
        key: "driver_to_restaurant",
        label: "Tài xế đến nhà hàng",
        from: toRoutePoint(driverLocation),
        to: toRoutePoint(restaurant),
      })
    );
  }

  if (restaurant && destination) {
    routeLegs.push(
      await buildRouteLeg({
        key: "restaurant_to_customer",
        label: "Nhà hàng đến khách hàng",
        from: toRoutePoint(restaurant),
        to: toRoutePoint(destination),
      })
    );
  }

  const routePoints = routeLegs.flatMap((leg, legIndex) => {
    if (!leg.geometry || leg.geometry.length === 0) {
      return [];
    }

    return legIndex === 0 ? leg.geometry : leg.geometry.slice(1);
  });
  const okLegs = routeLegs.filter((leg) => leg.ok);

  return {
    provider: "OSRM",
    status: routeLegs.length === 0 ? "UNAVAILABLE" : okLegs.length === routeLegs.length ? "OK" : okLegs.length > 0 ? "PARTIAL" : "ERROR",
    totalDistanceKm: Number(okLegs.reduce((total, leg) => total + Number(leg.distanceKm || 0), 0).toFixed(2)),
    totalDurationMinutes: Number(okLegs.reduce((total, leg) => total + Number(leg.durationMinutes || 0), 0).toFixed(1)),
    legs: routeLegs,
    routePoints,
  };
};

const emitOrderUpdated = (eventName, orderData) => {
  try {
    const io = socketManager.getIO();
    io.emit(eventName, orderData);
    io.emit("order:updated", orderData);
    io.to(`order:${orderData.id}`).emit(`order:${orderData.id}:updated`, orderData);
    if (orderData.driverId) {
      io.to(`driver:${orderData.driverId}`).emit("driver:order-updated", orderData);
    }
    if (eventName === "order:claimed" && orderData.customerId) {
      io.to(`customer:${orderData.customerId}`).emit(`customer:${orderData.customerId}:driver-assigned`, {
        orderId: orderData.id,
        orderCode: orderData.orderCode,
        statusCode: orderData.statusCode,
        driver: orderData.driver || null,
      });
    }
  } catch (error) {
    console.log("Socket not ready or err", error.message);
  }
};

const emitDispatchOffers = async (orderData) => {
  let dispatch;

  try {
    dispatch = await dispatchService.findDriverCandidatesForOrder(orderData);
  } catch (error) {
    console.log("Dispatch candidate search failed:", error.message);
    return {
      algorithm: dispatchService.DISPATCH_ALGORITHM,
      searchRadiusKm: null,
      candidates: [],
      reason: "DISPATCH_SEARCH_FAILED",
    };
  }

  try {
    const io = socketManager.getIO();
    io.to(`order:${orderData.id}`).emit(`order:${orderData.id}:dispatch`, {
      orderId: orderData.id,
      algorithm: dispatch.algorithm,
      searchRadiusKm: dispatch.searchRadiusKm,
      candidateCount: dispatch.candidates.length,
    });

    dispatch.candidates.forEach((candidate) => {
      io.to(`driver:${candidate.driverId || candidate.id}`).emit("driver:order-offered", {
        order: orderData,
        dispatch: {
          algorithm: dispatch.algorithm,
          searchRadiusKm: dispatch.searchRadiusKm,
          distanceKm: candidate.distanceKm,
          pickupEtaMinutes: candidate.pickupEtaMinutes,
          score: candidate.dispatchScore,
        },
      });
    });
  } catch (error) {
    console.log("Socket not ready or err", error.message);
  }

  return dispatch;
};

const assertMerchantOwnsOrder = async (userId, restaurantId) => {
  const restaurant = await Restaurant.findOne({ where: { id: restaurantId, ownerId: userId, deletedAt: null } });
  return Boolean(restaurant);
};

const canUpdateOrderStatus = async (req, order) => {
  if (!req.user) {
    return false;
  }

  if (req.user.role === "ADMIN") {
    return true;
  }

  if (req.user.role === "DRIVER") {
    return Number(order.driverId) === Number(req.user.id);
  }

  if (req.user.role === "MERCHANT") {
    return assertMerchantOwnsOrder(req.user.id, order.restaurantId);
  }

  return false;
};

exports.createOrder = async (req, res) => {
  try {
    const {
      restaurantId,
      voucherId,
      receiverAddress = "",
      receiverLat,
      receiverLng,
      distanceKm = 2,
      baseFee = DEFAULT_SHIPPING_BASE_FEE,
      discountAmount = 0,
      taxAmount = 0,
      shippingType = "STANDARD",
      orderCode,
      idempotencyKey,
      items,
    } = req.body;

    if (!req.user?.id || req.user.role !== "CUSTOMER") {
      return res.status(403).json({ message: "Only CUSTOMER accounts can create orders" });
    }

    const requestedItems = normalizeRequestedOrderItems(items);
    if (requestedItems.error) {
      return res.status(400).json({ message: requestedItems.error });
    }

    if (!Number.isFinite(Number(restaurantId))) {
      return res.status(400).json({ message: "restaurantId is required" });
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
      User.findByPk(Number(req.user.id)),
      Restaurant.findByPk(Number(restaurantId)),
    ]);

    if (!user || !restaurant) {
      return res.status(400).json({ message: "customer or restaurant not found" });
    }

    if (!restaurant.isOpen || restaurant.approvalStatus !== "APPROVED") {
      return res.status(400).json({ message: "restaurant is not accepting orders" });
    }

    const normalizedDistance = Number(distanceKm);
    const fallbackSubtotal = Number(baseFee);
    const normalizedDiscount = Number(discountAmount);
    const normalizedTax = Number(taxAmount);

    const [statusInfo, duplicated] = await Promise.all([
      resolveStatusByCode(DEFAULT_ORDER_STATUS_CODE),
      idempotencyKey ? orderRepository.findByIdempotencyKey(idempotencyKey) : Promise.resolve(null),
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
            include: [
              { model: Category, as: "category", attributes: ["id", "restaurantId"] },
              { model: Topping, as: "toppings", through: { attributes: [] } }
            ],
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
            throw createHttpError(409, `Đồ ăn không đủ. Món ${food.name} hiện chỉ còn ${availableQuantity} phần.`);
          }

          let itemToppingsCost = 0;
          const processedToppings = [];

          if (requestedItem.toppings && requestedItem.toppings.length > 0) {
            const foodToppingIds = new Set((food.toppings || []).map(t => Number(t.id)));
            const allToppingsMap = new Map((food.toppings || []).map(t => [Number(t.id), t]));

            for (const requestedTopping of requestedItem.toppings) {
              const toppingId = requestedTopping.id;
              const toppingQuantity = requestedTopping.quantity;
              
              if (!foodToppingIds.has(toppingId)) {
                throw createHttpError(400, `Topping #${toppingId} is not available for ${food.name}`);
              }
              const topping = allToppingsMap.get(toppingId);
              if (!topping.isAvailable) {
                throw createHttpError(400, `Topping ${topping.name} is out of stock`);
              }

              const todayStr = require("../models/Topping").getStockDate();
              if (topping.startDate && topping.startDate > todayStr) {
                throw createHttpError(400, `Topping ${topping.name} chưa mở bán.`);
              }
              if (topping.endDate && topping.endDate < todayStr) {
                throw createHttpError(400, `Topping ${topping.name} đã ngừng bán.`);
              }

              const availableToppingQty = Number(topping.currentQuantity || 0);
              const requestedTotalToppingQty = toppingQuantity * requestedItem.quantity;
              if (availableToppingQty < requestedTotalToppingQty) {
                throw createHttpError(409, `Topping không đủ. ${topping.name} hiện chỉ còn ${availableToppingQty} phần.`);
              }
              
              const toppingPrice = Number(topping.price || 0);
              itemToppingsCost += toppingPrice * toppingQuantity;
              processedToppings.push({
                toppingId: topping.id,
                toppingName: topping.name,
                priceAtOrder: toppingPrice,
                quantity: toppingQuantity,
                modelInstance: topping, // keep for deduction later
              });
            }
          }

          const priceAtOrder = Number(food.price || 0);
          normalizedSubtotal += (priceAtOrder + itemToppingsCost) * requestedItem.quantity;
          food.currentQuantity = availableQuantity - requestedItem.quantity;

          await food.save({ transaction });

          for (const pt of processedToppings) {
            const topping = pt.modelInstance;
            topping.currentQuantity = Number(topping.currentQuantity || 0) - (pt.quantity * requestedItem.quantity);
            await topping.save({ transaction });
            delete pt.modelInstance; // clean up before inserting
          }

          preparedOrderItems.push({
            foodId: food.id,
            foodName: food.name,
            quantity: requestedItem.quantity,
            priceAtOrder,
            toppings: processedToppings,
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
        driverId: null,
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
        for (const item of preparedOrderItems) {
          const orderItem = await OrderItem.create({
            orderId: newOrder.id,
            foodId: item.foodId,
            foodName: item.foodName,
            quantity: item.quantity,
            priceAtOrder: item.priceAtOrder,
          }, { transaction });

          if (item.toppings && item.toppings.length > 0) {
            await OrderItemTopping.bulkCreate(
              item.toppings.map(t => ({
                ...t,
                orderItemId: orderItem.id
              })),
              { transaction }
            );
          }
        }
      }

      createdOrderId = newOrder.id;
    });

    const created = await orderRepository.findById(createdOrderId);
    const orderData = normalizeOrder(created);

    try {
      socketManager.getIO().emit("new_order", orderData);
    } catch (error) {
      console.log("Socket not ready or err", error.message);
    }

    return res.status(201).json({
      message: "Created",
      data: orderData,
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" && req.body.idempotencyKey) {
      const duplicated = await orderRepository.findByIdempotencyKey(req.body.idempotencyKey);
      if (duplicated) {
        return res.status(200).json({ message: "Duplicated idempotency key", data: normalizeOrder(duplicated) });
      }
    }

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

    if (req.user?.role === "CUSTOMER") {
      filters.customerId = req.user.id;
    } else if (req.user?.role === "DRIVER") {
      filters.driverId = req.user.id;
    } else if (req.user?.role === "MERCHANT") {
      const ownedRestaurants = await Restaurant.findAll({
        where: { ownerId: req.user.id, deletedAt: null },
        attributes: ["id"],
      });
      const ownedIds = new Set(ownedRestaurants.map((restaurant) => Number(restaurant.id)));
      if (filters.restaurantId && !ownedIds.has(Number(filters.restaurantId))) {
        return res.json({ data: [] });
      }
      if (!filters.restaurantId) {
        if (ownedIds.size === 0) {
          return res.json({ data: [] });
        }
        filters.restaurantIds = Array.from(ownedIds);
      }
    }

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
    const trackingDriverId = orderData.driverId || (req.user?.role === "DRIVER" ? req.user.id : null);

    const [restaurant, driver, orderLocation, latestAnyLocation, reviews] = await Promise.all([
      Restaurant.findByPk(orderData.restaurantId),
      trackingDriverId
        ? DriverDetail.findOne({
            where: { userId: trackingDriverId },
            include: [{ model: User, as: "driverUser", attributes: ["id", "fullName", "phone", "ratingAvg"] }],
          })
        : Promise.resolve(null),
      trackingDriverId && orderData.driverId
        ? DriverLocation.findOne({
            where: { driverId: trackingDriverId, orderId: orderData.id },
            order: [["created_at", "DESC"]],
          })
        : Promise.resolve(null),
      trackingDriverId
        ? DriverLocation.findOne({
            where: { driverId: trackingDriverId },
            order: [["created_at", "DESC"]],
          })
        : Promise.resolve(null),
      Review.findAll({
        where: { orderId: orderData.id },
        raw: true,
      }),
    ]);

    const restaurantData = normalizeRestaurantSummary(restaurant);
    const destination = {
      latitude: Number(orderData.receiverLat || restaurantData?.latitude || 0),
      longitude: Number(orderData.receiverLng || restaurantData?.longitude || 0),
    };
    const cachedOrderLocation = trackingDriverId && orderData.driverId
      ? locationStreamService.getLatestLocation(trackingDriverId, orderData.id)
      : null;
    const cachedAnyLocation = trackingDriverId
      ? locationStreamService.getLatestLocation(trackingDriverId)
      : null;
    const locationData = normalizeDriverLocation(cachedOrderLocation || cachedAnyLocation || orderLocation || latestAnyLocation);
    const route = await buildTrackingRoute({
      driverLocation: locationData,
      restaurant: restaurantData,
      destination,
    });

    return res.json({
      data: {
        order: orderData,
        restaurant: restaurantData,
        driver: normalizeDriverForTracking(driver),
        driverLocation: locationData,
        destination,
        route,
        routePoints: route.routePoints,
        routeProgress: calculateRouteProgress(locationData, route.routePoints),
        reviews: reviews.map((r) => ({
          id: Number(r.id),
          targetType: r.targetType,
          targetId: Number(r.targetId),
          rating: Number(r.rating),
          comment: r.comment || "",
          createdAt: r.createdAt,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.acceptOrder = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const driverId = Number(req.user?.id);

    if (!Number.isFinite(driverId) || req.user.role !== "DRIVER") {
      return res.status(403).json({ message: "Only DRIVER accounts can accept orders" });
    }

    const driver = await DriverDetail.findOne({ where: { userId: driverId } });
    if (!driver || driver.approvalStatus !== "APPROVED") {
      return res.status(403).json({ message: "Driver account is not approved" });
    }

    if (!driver.isOnline) {
      return res.status(409).json({ message: "Driver must be online before accepting orders" });
    }

    let orderId = null;

    await sequelize.transaction(async (transaction) => {
      const [confirmedStatus, acceptedStatus] = await Promise.all([
        resolveStatusByCode("CONFIRMED", { transaction }),
        resolveStatusByCode("DRIVER_ACCEPTED", { transaction }),
      ]);

      if (!confirmedStatus || !acceptedStatus) {
        throw createHttpError(500, "Order statuses are not configured");
      }

      const order = await Order.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!order) {
        throw createHttpError(404, "Order not found");
      }

      if (order.driverId && Number(order.driverId) !== driverId) {
        throw createHttpError(409, "Đơn hàng đã có người nhận");
      }

      if (order.driverId && Number(order.driverId) === driverId) {
        orderId = order.id;
        return;
      }

      if (Number(order.statusId) !== Number(confirmedStatus.id)) {
        throw createHttpError(409, "Only confirmed orders can be accepted");
      }

      const [restaurant, persistedLocation] = await Promise.all([
        Restaurant.findByPk(order.restaurantId, { transaction }),
        DriverLocation.findOne({
          where: { driverId },
          order: [["created_at", "DESC"]],
          transaction,
        }),
      ]);
      const latestLocation = locationStreamService.getLatestLocation(driverId) || persistedLocation;

      if (!restaurant || !driverService.hasValidPoint(restaurant)) {
        throw createHttpError(409, "Order pickup location is not available");
      }

      if (!driverService.hasValidPoint(latestLocation)) {
        throw createHttpError(409, "Driver location is required before accepting an order");
      }

      const nearbyDriver = driverService.findNearestDriver(
        [
          {
            id: driverId,
            latitude: latestLocation.latitude,
            longitude: latestLocation.longitude,
            geohash: latestLocation.geohash,
          },
        ],
        restaurant,
        { radiusKm: MAX_DRIVER_ACCEPT_RADIUS_KM }
      );

      if (!nearbyDriver || Number(nearbyDriver.distanceKm) > MAX_DRIVER_ACCEPT_RADIUS_KM) {
        throw createHttpError(409, `Driver must be within ${MAX_DRIVER_ACCEPT_RADIUS_KM}km of the restaurant`);
      }

      const activeStatuses = await OrderStatus.findAll({
        where: { code: { [Op.in]: Array.from(DRIVER_ACTIVE_STATUS_CODES) } },
        transaction,
      });
      const activeStatusIds = activeStatuses.map((status) => status.id).filter(Boolean);

      if (activeStatusIds.length > 0) {
        const existingActiveOrder = await Order.findOne({
          where: {
            driverId,
            statusId: { [Op.in]: activeStatusIds },
            id: { [Op.ne]: id },
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (existingActiveOrder) {
          throw createHttpError(
            409,
            "Driver already has an active order. Complete it before accepting another."
          );
        }
      }

      await order.update(
        {
          driverId,
          statusId: acceptedStatus.id,
          statusChangedAt: new Date(),
          version: Number(order.version || 0) + 1,
        },
        { transaction }
      );

      orderId = order.id;
    });

    const latest = await orderRepository.findById(orderId);
    const orderData = normalizeOrder(latest);
    emitOrderUpdated("order:claimed", orderData);

    return res.json({ message: "Accepted", data: orderData });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ message: "Only ADMIN can edit order fields directly" });
    }

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

    if (driverId !== undefined) {
      return res.status(400).json({ message: "Use the accept endpoint to assign a driver" });
    }

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
      item.statusChangedAt = new Date();
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
    emitOrderUpdated("order:updated", orderData);

    return res.json({ message: "Updated", data: orderData });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, statusCode, expectedVersion } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const resolvedStatus = await resolveStatusByCode(statusCode !== undefined ? statusCode : status);
    if (!resolvedStatus) {
      return res.status(400).json({ message: "Invalid statusCode" });
    }

    let orderId = null;
    let didChangeStatus = false;

    await sequelize.transaction(async (transaction) => {
      const item = await Order.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!item) {
        throw createHttpError(404, "Order not found");
      }

      if (!(await canUpdateOrderStatus(req, item))) {
        throw createHttpError(403, "Forbidden");
      }

      const currentStatus = await OrderStatus.findByPk(item.statusId, { transaction });
      const transition = orderWorkflowService.validateTransition({
        role: req.user?.role,
        fromStatusCode: currentStatus?.code,
        toStatusCode: resolvedStatus.code,
        order: item,
      });
      if (!transition.ok) {
        throw createHttpError(transition.statusCode || 409, transition.message);
      }

      if (expectedVersion !== undefined && Number(expectedVersion) !== Number(item.version)) {
        throw createHttpError(409, "Version conflict");
      }

      orderId = item.id;
      if (Number(item.statusId) === Number(resolvedStatus.id)) {
        return;
      }

      await item.update(
        {
          statusId: resolvedStatus.id,
          statusChangedAt: new Date(),
          version: Number(item.version || 0) + 1,
        },
        { transaction }
      );
      didChangeStatus = true;
    });

    const latest = await orderRepository.findById(orderId);
    const orderData = normalizeOrder(latest);
    if (didChangeStatus) {
      emitOrderUpdated("order:updated", orderData);
    }
    const dispatch = didChangeStatus && resolvedStatus.code === "CONFIRMED"
      ? await emitDispatchOffers(orderData)
      : null;

    if (resolvedStatus.code === "DELIVERING" && orderData.customerId) {
      try {
        socketManager.getIO().to(`customer:${orderData.customerId}`).emit(`customer:${orderData.customerId}:driver-delivering`, {
          orderId: orderData.id,
          orderCode: orderData.orderCode,
          statusCode: orderData.statusCode,
          driver: orderData.driver || null,
          cashToCollect: orderData.cashToCollect,
          totalAmount: orderData.totalAmount,
        });
      } catch (error) {
        console.log("Socket not ready or err", error.message);
      }
    }

    if (resolvedStatus.code === "COMPLETED" && orderData.customerId) {
      try {
        socketManager.getIO().to(`customer:${orderData.customerId}`).emit(`customer:${orderData.customerId}:delivery-completed`, {
          orderId: orderData.id,
          orderCode: orderData.orderCode,
          statusCode: orderData.statusCode,
          driver: orderData.driver || null,
          totalAmount: orderData.totalAmount,
        });
      } catch (error) {
        console.log("Socket not ready or err", error.message);
      }
    }

    return res.json({
      message: "Updated",
      data: orderData,
      meta: dispatch
        ? {
            dispatch: {
              algorithm: dispatch.algorithm,
              searchRadiusKm: dispatch.searchRadiusKm,
              candidateCount: dispatch.candidates.length,
            },
          }
        : undefined,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.rejectOrder = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const reason = String(req.body.reason || "").trim();
    const expectedVersion = req.body.expectedVersion;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    if (!reason) {
      return res.status(400).json({ message: "Reject reason is required" });
    }

    if (reason.length > 500) {
      return res.status(400).json({ message: "Reject reason must not exceed 500 characters" });
    }

    await sequelize.transaction(async (transaction) => {
      const order = await Order.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!order) {
        throw createHttpError(404, "Order not found");
      }

      const restaurant = await Restaurant.findOne({
        where: { id: order.restaurantId, ownerId: req.user.id, deletedAt: null },
        transaction,
      });

      if (!restaurant) {
        throw createHttpError(403, "You are not allowed to reject this order");
      }

      if (expectedVersion !== undefined && Number(expectedVersion) !== Number(order.version)) {
        throw createHttpError(409, "Version conflict");
      }

      const currentStatus = await OrderStatus.findByPk(order.statusId, { transaction });
      if (!currentStatus || !["PENDING", "CONFIRMED"].includes(currentStatus.code)) {
        throw createHttpError(409, "Only pending or unassigned confirmed orders can be rejected");
      }

      if (order.driverId) {
        throw createHttpError(409, "Cannot reject an order after a driver has accepted it");
      }

      const cancelledStatus = await OrderStatus.findOne({
        where: { code: "CANCELLED" },
        transaction,
      });
      if (!cancelledStatus) {
        throw createHttpError(500, "CANCELLED order status is not configured");
      }

      const orderItems = await OrderItem.findAll({
        where: { orderId: order.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      for (const orderItem of orderItems) {
        const food = await Food.findByPk(orderItem.foodId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!food) {
          continue;
        }

        food.currentQuantity = Math.min(
          Number(food.defaultQuantity || 0),
          Number(food.currentQuantity || 0) + Number(orderItem.quantity || 0)
        );
        await food.save({ transaction });
      }

      await order.update(
        {
          statusId: cancelledStatus.id,
          cancelReason: reason,
          cancelledByRole: "MERCHANT",
          cancelledByUserId: req.user.id,
          cancelledAt: new Date(),
          version: Number(order.version || 0) + 1,
        },
        { transaction }
      );
    });

    const rejected = await orderRepository.findById(id);
    const orderData = normalizeOrder(rejected);

    try {
      emitOrderUpdated("order:updated", orderData);

      if (orderData.customerId) {
        socketManager.getIO().to(`customer:${orderData.customerId}`).emit(`customer:${orderData.customerId}:order-rejected`, {
          orderId: orderData.id,
          orderCode: orderData.orderCode,
          rejectReason: orderData.cancelReason,
          message: "Đơn hàng của bạn đã bị nhà hàng từ chối."
        });
      }
    } catch (error) {
      console.log("Socket not ready or err", error.message);
    }

    return res.json({ message: "Order rejected", data: orderData });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const reason = String(req.body.reason || "Khách hàng hủy đơn").trim();

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    await sequelize.transaction(async (transaction) => {
      const order = await Order.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!order) {
        throw createHttpError(404, "Order not found");
      }

      if (Number(order.customerId) !== Number(req.user.id)) {
        throw createHttpError(403, "You are not allowed to cancel this order");
      }

      if (order.driverId) {
        throw createHttpError(400, "Không thể hủy đơn hàng vì tài xế đã nhận đơn");
      }

      const currentStatus = await OrderStatus.findByPk(order.statusId, { transaction });
      if (!currentStatus || !["PENDING", "CONFIRMED"].includes(currentStatus.code)) {
        throw createHttpError(400, "Chỉ có thể hủy đơn hàng ở trạng thái chờ xác nhận hoặc đã xác nhận (chưa có tài xế)");
      }

      const cancelledStatus = await OrderStatus.findOne({
        where: { code: "CANCELLED" },
        transaction,
      });
      if (!cancelledStatus) {
        throw createHttpError(500, "CANCELLED order status is not configured");
      }

      const orderItems = await OrderItem.findAll({
        where: { orderId: order.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      for (const orderItem of orderItems) {
        const food = await Food.findByPk(orderItem.foodId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!food) {
          continue;
        }

        food.currentQuantity = Math.min(
          Number(food.defaultQuantity || 0),
          Number(food.currentQuantity || 0) + Number(orderItem.quantity || 0)
        );
        await food.save({ transaction });
      }

      await order.update(
        {
          statusId: cancelledStatus.id,
          cancelReason: reason,
          cancelledByRole: "CUSTOMER",
          cancelledByUserId: req.user.id,
          cancelledAt: new Date(),
          version: Number(order.version || 0) + 1,
        },
        { transaction }
      );
    });

    const cancelledOrder = await orderRepository.findById(id);
    const orderData = normalizeOrder(cancelledOrder);

    try {
      emitOrderUpdated("order:updated", orderData);

    } catch (error) {
      console.log("Socket not ready or err", error.message);
    }

    return res.json({ message: "Order cancelled successfully", data: orderData });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ message: "Only ADMIN can delete orders" });
    }

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

exports.getRoute = async (req, res) => {
  try {
    const fromLat = Number(req.query.fromLat);
    const fromLng = Number(req.query.fromLng);
    const toLat = Number(req.query.toLat);
    const toLng = Number(req.query.toLng);

    if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
      return res.status(400).json({ message: "Invalid coordinates" });
    }

    const route = await osrmService.getRoute(
      { latitude: fromLat, longitude: fromLng },
      { latitude: toLat, longitude: toLng }
    );
    return res.json({ data: route });
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
