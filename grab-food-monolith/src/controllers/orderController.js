const shippingService = require("../services/shippingService");
const { Order, User, Restaurant, sequelize } = require("../models");

const VALID_STATUSES = ["PENDING", "CONFIRMED", "PICKING_UP", "DELIVERING", "COMPLETED", "CANCELLED"];
const DEFAULT_SHIPPING_BASE_FEE = 20000;

const getBaseFeeFromOrder = (order) => {
  return Math.max(0, Number(order.totalAmount || 0) - Number(order.shippingFee || 0));
};

const normalizeOrder = (item) => ({
  id: item.id,
  customer: item.customerUser ? item.customerUser.fullName || `User ${item.customerId}` : `User ${item.customerId}`,
  customerId: item.customerId,
  restaurantId: item.restaurantId,
  receiverAddress: item.receiverAddress || "",
  receiverLat: item.receiverLat,
  receiverLng: item.receiverLng,
  distanceKm: Number(item.distanceKm || 0),
  baseFee: getBaseFeeFromOrder(item),
  totalAmount: Number(item.totalAmount || 0),
  shippingFee: Number(item.shippingFee || 0),
  status: item.status,
  paymentMethod: item.paymentMethod,
  createdAt: item.createdAt,
});

exports.createOrder = async (req, res) => {
  try {
    const {
      customerId,
      restaurantId,
      receiverAddress = "",
      receiverLat,
      receiverLng,
      distanceKm = 2,
      baseFee = DEFAULT_SHIPPING_BASE_FEE,
      paymentMethod = "CASH",
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

    const [user, restaurant] = await Promise.all([
      User.findByPk(Number(customerId)),
      Restaurant.findByPk(Number(restaurantId)),
    ]);

    if (!user || !restaurant) {
      return res.status(400).json({ message: "customer or restaurant not found" });
    }

    const normalizedDistance = Number(distanceKm);
    const normalizedBaseFee = Number(baseFee);
    const shippingFee = shippingService.calculateShippingFee(normalizedDistance, normalizedBaseFee);
    const totalAmount = normalizedBaseFee + shippingFee;

    const orderId = `ORD-${Date.now()}`;

    const newOrder = await Order.create({
      id: orderId,
      customerId: user.id,
      restaurantId: restaurant.id,
      driverId: null,
      receiverAddress: String(receiverAddress).trim(),
      receiverLat: Number(receiverLat),
      receiverLng: Number(receiverLng),
      distanceKm: normalizedDistance,
      totalAmount,
      shippingFee,
      status: "PENDING",
      paymentMethod: String(paymentMethod).trim().toUpperCase() === "E-WALLET" ? "E-WALLET" : "CASH",
    });

    const created = await Order.findByPk(orderId, {
      include: [{ model: User, as: "customerUser", attributes: ["id", "fullName"] }],
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
    include: [{ model: User, as: "customerUser", attributes: ["id", "fullName"] }],
    order: [[sequelize.col("Order.created_at"), "DESC"]],
  })
    .then((items) => res.json({ data: items.map(normalizeOrder) }))
    .catch((error) => res.status(500).json({ message: error.message }));
};

exports.getOrderById = async (req, res) => {
  try {
    const id = String(req.params.id);
    const item = await Order.findByPk(id, {
      include: [{ model: User, as: "customerUser", attributes: ["id", "fullName"] }],
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
    const id = String(req.params.id);
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
      paymentMethod,
      status,
    } = req.body;

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

    if (paymentMethod !== undefined) {
      const normalizedPayment = String(paymentMethod).trim().toUpperCase();
      item.paymentMethod = normalizedPayment === "E-WALLET" ? "E-WALLET" : "CASH";
    }

    if (status !== undefined) {
      const normalizedStatus = String(status).trim().toUpperCase();
      if (!VALID_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      item.status = normalizedStatus;
    }

    if (baseFee !== undefined && !Number.isFinite(Number(baseFee))) {
      return res.status(400).json({ message: "baseFee must be a number" });
    }

    const nextBaseFee = baseFee !== undefined ? Number(baseFee) : getBaseFeeFromOrder(item) || DEFAULT_SHIPPING_BASE_FEE;
    const normalizedDistance = Number(item.distanceKm || 0);

    item.shippingFee = shippingService.calculateShippingFee(normalizedDistance, nextBaseFee);
    item.totalAmount = nextBaseFee + Number(item.shippingFee || 0);

    await item.save();

    const latest = await Order.findByPk(id, {
      include: [{ model: User, as: "customerUser", attributes: ["id", "fullName"] }],
    });

    return res.json({ message: "Updated", data: normalizeOrder(latest || item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateOrderStatus = (req, res) => {
  const id = String(req.params.id);
  const { status } = req.body;

  const normalizedStatus = String(status || "").trim().toUpperCase();
  if (!VALID_STATUSES.includes(normalizedStatus)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  return Order.findByPk(id)
    .then((item) => {
      if (!item) {
        return res.status(404).json({ message: "Order not found" });
      }

      return item
        .update({
          status: normalizedStatus,
        })
        .then(() =>
          Order.findByPk(id, {
            include: [{ model: User, as: "customerUser", attributes: ["id", "fullName"] }],
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
    const id = String(req.params.id);
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
  return Order.findAll({ order: [[sequelize.col("Order.created_at"), "DESC"]] })
    .then((items) => {
      res.render("orders", {
        orders: items,
      });
    })
    .catch(() => {
      res.render("orders", {
        orders: [],
      });
    });
};
