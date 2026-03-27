const { Order, User, OrderStatus } = require("../models");

const orderIncludes = [
  { model: User, as: "customerUser", attributes: ["id", "fullName"] },
  { model: OrderStatus, as: "statusInfo", attributes: ["id", "code", "label"] },
];

class OrderRepository {
  getIncludes() {
    return orderIncludes;
  }

  create(payload) {
    return Order.create(payload);
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

  findAll() {
    return Order.findAll({
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
