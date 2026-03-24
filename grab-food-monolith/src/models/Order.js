const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Order = sequelize.define(
  "Order",
  {
    id: { type: DataTypes.STRING(50), primaryKey: true },
    customerId: { type: DataTypes.INTEGER, allowNull: false, field: "customer_id" },
    restaurantId: { type: DataTypes.INTEGER, allowNull: false, field: "restaurant_id" },
    driverId: { type: DataTypes.INTEGER, field: "driver_id" },
    receiverAddress: { type: DataTypes.TEXT, field: "receiver_address" },
    receiverLat: { type: DataTypes.DOUBLE, field: "receiver_lat" },
    receiverLng: { type: DataTypes.DOUBLE, field: "receiver_lng" },
    distanceKm: { type: DataTypes.DOUBLE, field: "distance_km" },
    totalAmount: { type: DataTypes.DECIMAL(10, 2), field: "total_amount" },
    shippingFee: { type: DataTypes.DECIMAL(10, 2), field: "shipping_fee" },
    status: {
      type: DataTypes.ENUM("PENDING", "CONFIRMED", "PICKING_UP", "DELIVERING", "COMPLETED", "CANCELLED"),
      defaultValue: "PENDING",
    },
    paymentMethod: {
      type: DataTypes.ENUM("CASH", "E-WALLET"),
      defaultValue: "CASH",
      field: "payment_method",
    },
  },
  {
    tableName: "orders",
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = Order;
