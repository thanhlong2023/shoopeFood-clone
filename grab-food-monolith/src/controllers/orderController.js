const shippingService = require("../services/shippingService");
const { Order, User, Restaurant, OrderStatus } = require("../models");

const DEFAULT_SHIPPING_BASE_FEE = 20000;
const DEFAULT_ORDER_STATUS_CODE = "PENDING";

const getBaseFeeFromOrder = (order) => {
  if (order.subtotalAmount !== undefined && order.subtotalAmount !== null) {
    return Number(order.subtotalAmount || 0);
  }
  return Math.max(0, Number(order.totalAmount || 0) - Number(order.shippingFee || 0));
};

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
  version: item.version,
  createdAt: item.createdAt,
});

const orderIncludes = [
  { model: User, as: "customerUser", attributes: ["id", "fullName"] },
  { model: OrderStatus, as: "statusInfo", attributes: ["id", "code", "label"] },
];

const buildOrderCode = () => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `ORD-${datePart}-${Date.now()}`;
};

const buildIdempotencyKey = () => {
  return `IDEM-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const resolveStatusByCode = async (statusCode = DEFAULT_ORDER_STATUS_CODE) => {
  const normalizedCode = String(statusCode || "").trim().toUpperCase() || DEFAULT_ORDER_STATUS_CODE;
  const status = await OrderStatus.findOne({ where: { code: normalizedCode } });
  if (!status) {
    return null;
  }
  return status;
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
      orderCode,
      idempotencyKey,
    } = req.body;

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

    const normalizedDistance = Number(distanceKm);
    const normalizedSubtotal = Number(baseFee);
    const normalizedDiscount = Number(discountAmount);
    const normalizedTax = Number(taxAmount);
    const shippingFee = shippingService.calculateShippingFee(normalizedDistance, normalizedSubtotal);
    const totalAmount = normalizedSubtotal + shippingFee + normalizedTax - normalizedDiscount;

    const [statusInfo, duplicated] = await Promise.all([
      resolveStatusByCode(statusCode),
      idempotencyKey
        ? Order.findOne({ where: { idempotencyKey: String(idempotencyKey).trim() }, include: orderIncludes })
        : Promise.resolve(null),
    ]);

    if (!statusInfo) {
      return res.status(400).json({ message: "Invalid statusCode" });
    }

    if (duplicated) {
      return res.status(200).json({ message: "Duplicated idempotency key", data: normalizeOrder(duplicated) });
    }

    const normalizedIdempotencyKey = String(idempotencyKey || buildIdempotencyKey()).trim();
    const normalizedOrderCode = String(orderCode || buildOrderCode()).trim();

    const newOrder = await Order.create({
      orderCode: normalizedOrderCode,
      idempotencyKey: normalizedIdempotencyKey,
      customerId: user.id,
      restaurantId: restaurant.id,
      driverId: Number.isFinite(Number(driverId)) ? Number(driverId) : null,
      voucherId: Number.isFinite(Number(voucherId)) ? Number(voucherId) : null,
      receiverAddress: String(receiverAddress).trim(),
      receiverLat: Number(receiverLat),
      receiverLng: Number(receiverLng),
      distanceKm: normalizedDistance,
      subtotalAmount: normalizedSubtotal,
      taxAmount: normalizedTax,
      totalAmount,
      shippingFee,
      discountAmount: normalizedDiscount,
      statusId: statusInfo.id,
      version: 0,
    });

    const created = await Order.findByPk(newOrder.id, {
      include: orderIncludes,
    });

    return res.status(201).json({
      message: "Created",
      data: normalizeOrder(created || newOrder),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getOrders = (req, res) => {
  return Order.findAll({
    include: orderIncludes,
    order: [["created_at", "DESC"]],
  })
    .then((items) => res.json({ data: items.map(normalizeOrder) }))
    .catch((error) => res.status(500).json({ message: error.message }));
};

exports.getOrderById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await Order.findByPk(id, {
      include: orderIncludes,
    });

    if (!item) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.json({ data: normalizeOrder(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await Order.findByPk(id);

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

    item.shippingFee = shippingService.calculateShippingFee(normalizedDistance, nextBaseFee);
    item.subtotalAmount = nextBaseFee;
    item.discountAmount = nextDiscount;
    item.taxAmount = nextTax;
    item.totalAmount = nextBaseFee + Number(item.shippingFee || 0) + nextTax - nextDiscount;
    item.version = Number(item.version || 0) + 1;

    await item.save();

    const latest = await Order.findByPk(id, {
      include: orderIncludes,
    });

    return res.json({ message: "Updated", data: normalizeOrder(latest || item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateOrderStatus = (req, res) => {
  const id = Number(req.params.id);
  const { status, statusCode, expectedVersion } = req.body;

  return Promise.all([
    Order.findByPk(id),
    resolveStatusByCode(statusCode !== undefined ? statusCode : status),
  ])
    .then(([item, resolvedStatus]) => {
      if (!item) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (!resolvedStatus) {
        return res.status(400).json({ message: "Invalid statusCode" });
      }

      if (expectedVersion !== undefined && Number(expectedVersion) !== Number(item.version)) {
        return res.status(409).json({ message: "Version conflict" });
      }

      return item
        .update({
          statusId: resolvedStatus.id,
          version: Number(item.version || 0) + 1,
        })
        .then(() =>
          Order.findByPk(id, {
            include: orderIncludes,
          }).then((latest) =>
            res.json({
              message: "Updated",
              data: normalizeOrder(latest),
            })
          )
        );
    })
    .catch((error) => res.status(500).json({ message: error.message }));
};

exports.deleteOrder = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await Order.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "Order not found" });
    }

    await item.destroy();
    return res.json({ message: "Deleted", data: { id: item.id } });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getOrdersPage = (req, res) => {
  return Order.findAll({ include: orderIncludes, order: [["created_at", "DESC"]] })
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
