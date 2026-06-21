const { Order, User, OrderStatus, Payment, OrderItem, Food, Restaurant, DriverDetail, OrderItemTopping } = require("../models");

const orderIncludes = [
  { model: User, as: "customerUser", attributes: ["id", "fullName", "phone"] },
  {
    model: User,
    as: "driverUser",
    attributes: ["id", "fullName", "phone", "ratingAvg"],
    include: [
      {
        model: DriverDetail,
        as: "driverDetail",
        attributes: ["vehicleType", "licensePlate", "isOnline"],
      },
    ],
  },
  { model: Restaurant, attributes: ["id", "name", "address", "latitude", "longitude", "isOpen"] },
  { model: OrderStatus, as: "statusInfo", attributes: ["id", "code", "label"] },
  { model: Payment, as: "payment", attributes: ["id", "paymentMethod", "status", "amount"] },
  {
    model: OrderItem,
    as: "items",
    attributes: ["id", "orderId", "foodId", "foodName", "quantity", "priceAtOrder"],
    include: [
      { model: Food, as: "food", attributes: ["id", "name", "price", "imageUrl"] },
      { 
        model: OrderItemTopping, 
        as: "toppings",
        attributes: ["id", "toppingId", "toppingName", "priceAtOrder", "quantity"]
      }
    ],
  },
];

class OrderRepository {
  getIncludes() {
    return orderIncludes;
  }

  create(payload, options = {}) {
    return Order.create(payload, options);
  }

  findById(id) {
    return Order.findByPk(Number(id), {
      include: orderIncludes,
    });
  }

  findEntityById(id) {
    return Order.findByPk(Number(id));
  }

  findByIdempotencyKey(idempotencyKey) {
    return Order.findOne({
      where: { idempotencyKey: String(idempotencyKey || "").trim() },
      include: orderIncludes,
    });
  }

  findAll(filters = {}) {
    const { Op } = require("sequelize");
    const where = {};
    if (filters.statusId) {
      where.statusId = filters.statusId;
    }
    if (filters.restaurantIds && filters.restaurantIds.length > 0) {
      where.restaurantId = { [Op.in]: filters.restaurantIds };
    } else if (filters.restaurantId) {
      where.restaurantId = filters.restaurantId;
    }
    if (filters.customerId) {
      where.customerId = filters.customerId;
    }
    if (filters.driverId) {
      where.driverId = filters.driverId;
    }
    if (filters.fromDate && filters.toDate) {
      where.createdAt = {
        [Op.between]: [filters.fromDate, filters.toDate]
      };
    } else if (filters.fromDate) {
      where.createdAt = {
        [Op.gte]: filters.fromDate
      };
    } else if (filters.toDate) {
      where.createdAt = {
        [Op.lte]: filters.toDate
      };
    }

    return Order.findAll({
      where,
      include: orderIncludes,
      order: [["created_at", "DESC"]],
    });
  }

  async update(orderEntity, changes) {
    await orderEntity.update(changes);
    return this.findById(orderEntity.id);
  }

  async save(orderEntity) {
    await orderEntity.save();
    return this.findById(orderEntity.id);
  }

  async delete(orderEntity) {
    await orderEntity.destroy();
    return { id: orderEntity.id };
  }
}

module.exports = new OrderRepository();
