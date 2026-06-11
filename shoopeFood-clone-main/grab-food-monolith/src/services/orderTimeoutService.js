const { Op } = require("sequelize");
const { sequelize, Order, OrderStatus, OrderItem, Food } = require("../models");
const orderRepository = require("../repositories/orderRepository");
const socketManager = require("../sockets");
const { normalizeOrder } = require("../utils/orderNormalizer");

const POLL_INTERVAL_MS = Number(process.env.ORDER_TIMEOUT_POLL_MS || 30_000);
const TIMEOUT_MINUTES = Number(process.env.ORDER_DRIVER_ACCEPT_TIMEOUT_MINUTES || 10);
const CANCEL_REASON = "Khong co tai xe nhan don trong thoi gian cho";

const restoreOrderItems = async (orderId, transaction) => {
  const orderItems = await OrderItem.findAll({
    where: { orderId },
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
      Number(food.currentQuantity || 0) + Number(orderItem.quantity || 0),
    );
    await food.save({ transaction });
  }
};

const emitOrderTimedOut = (orderData) => {
  try {
    const io = socketManager.getIO();
    io.emit("order:updated", orderData);
    io.emit(`order:${orderData.id}:updated`, orderData);
    io.emit("order:timeout", orderData);
    if (orderData.customerId) {
      io.emit(`customer:${orderData.customerId}:order-timeout`, {
        orderId: orderData.id,
        orderCode: orderData.orderCode,
        statusCode: orderData.statusCode,
        message: CANCEL_REASON,
      });
    }
  } catch (error) {
    console.log("Socket not ready or err", error.message);
  }
};

const cancelUnassignedPendingOrders = async () => {
  const pendingStatus = await OrderStatus.findOne({ where: { code: "PENDING" } });
  const timeoutStatus =
    (await OrderStatus.findOne({ where: { code: "TIMEOUT" } })) ||
    (await OrderStatus.findOne({ where: { code: "CANCELLED" } }));

  if (!pendingStatus || !timeoutStatus) {
    return 0;
  }

  const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000);
  const staleOrders = await Order.findAll({
    where: {
      statusId: pendingStatus.id,
      driverId: null,
      createdAt: { [Op.lt]: cutoff },
    },
    attributes: ["id"],
  });

  let cancelledCount = 0;

  for (const stale of staleOrders) {
    try {
      await sequelize.transaction(async (transaction) => {
        const order = await Order.findByPk(stale.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!order || order.driverId !== null || order.statusId !== pendingStatus.id) {
          return;
        }

        await restoreOrderItems(order.id, transaction);

        await order.update(
          {
            statusId: timeoutStatus.id,
            cancelReason: CANCEL_REASON,
            cancelledByRole: "SYSTEM",
            cancelledByUserId: null,
            cancelledAt: new Date(),
            version: Number(order.version || 0) + 1,
          },
          { transaction },
        );
      });

      const updated = await orderRepository.findById(stale.id);
      if (updated) {
        emitOrderTimedOut(normalizeOrder(updated));
      }
      cancelledCount += 1;
    } catch (error) {
      console.error(`Cannot timeout order #${stale.id}:`, error.message);
    }
  }

  return cancelledCount;
};

const schedulePendingOrderTimeoutSweep = () => {
  let timer = null;
  let running = false;

  const run = async () => {
    if (running) {
      timer = setTimeout(run, POLL_INTERVAL_MS);
      return;
    }

    running = true;
    try {
      const count = await cancelUnassignedPendingOrders();
      if (count > 0) {
        console.log(`Auto-cancelled ${count} unassigned order(s) after ${TIMEOUT_MINUTES} minute(s)`);
      }
    } catch (error) {
      console.error("Pending order timeout sweep failed:", error.message);
    } finally {
      running = false;
      timer = setTimeout(run, POLL_INTERVAL_MS);
    }
  };

  void run();

  return () => {
    if (timer) {
      clearTimeout(timer);
    }
  };
};

module.exports = {
  cancelUnassignedPendingOrders,
  schedulePendingOrderTimeoutSweep,
};
