const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Order = sequelize.define(
  "Order",
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    orderCode: { type: DataTypes.STRING(50), allowNull: false, field: "order_code" },
    idempotencyKey: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: "idempotency_key" },
    customerId: { type: DataTypes.INTEGER, allowNull: false, field: "customer_id" },
    restaurantId: { type: DataTypes.INTEGER, allowNull: false, field: "restaurant_id" },
    driverId: { type: DataTypes.INTEGER, field: "driver_id" },
    voucherId: { type: DataTypes.INTEGER, field: "voucher_id" },
    receiverAddress: { type: DataTypes.TEXT, field: "receiver_address" },
    receiverLat: { type: DataTypes.DOUBLE, field: "receiver_lat" },
    receiverLng: { type: DataTypes.DOUBLE, field: "receiver_lng" },
    distanceKm: { type: DataTypes.DOUBLE, field: "distance_km" },
    subtotalAmount: { type: DataTypes.DECIMAL(10, 2), field: "subtotal_amount" },
    taxAmount: { type: DataTypes.DECIMAL(10, 2), field: "tax_amount", defaultValue: 0 },
    discountAmount: { type: DataTypes.DECIMAL(10, 2), field: "discount_amount", defaultValue: 0 },
    totalAmount: { type: DataTypes.DECIMAL(10, 2), field: "total_amount" },
    shippingFee: { type: DataTypes.DECIMAL(10, 2), field: "shipping_fee" },
    statusId: { type: DataTypes.INTEGER, allowNull: false, field: "status_id" },
    statusChangedAt: { type: DataTypes.DATE, field: "status_changed_at" },
    note: { type: DataTypes.TEXT, field: "note" },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    cancelReason: { type: DataTypes.TEXT, field: "cancel_reason" },
    cancelledByRole: { type: DataTypes.STRING(20), field: "cancelled_by_role" },
    cancelledByUserId: { type: DataTypes.INTEGER, field: "cancelled_by_user_id" },
    cancelledAt: { type: DataTypes.DATE, field: "cancelled_at" },
    deletedAt: { type: DataTypes.DATE, field: "deleted_at" },
    createdAt: { type: DataTypes.DATE, field: "created_at" },
  },
  {
    tableName: "orders",
    timestamps: true,
    updatedAt: false,
  }
);

module.exports = Order;
