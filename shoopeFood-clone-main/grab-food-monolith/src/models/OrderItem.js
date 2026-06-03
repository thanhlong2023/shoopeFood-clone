const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const OrderItem = sequelize.define(
  "OrderItem",
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    orderId: { type: DataTypes.BIGINT, allowNull: false, field: "order_id" },
    foodId: { type: DataTypes.INTEGER, allowNull: false, field: "food_id" },
    foodName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "food_name",
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 },
    },
    priceAtOrder: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: "price_at_order",
    },
  },
  {
    tableName: "order_items",
    createdAt: false,
    updatedAt: false,
    indexes: [
      { name: "idx_order_items_order_id", fields: ["order_id"] },
      { name: "idx_order_items_food_id", fields: ["food_id"] },
    ],
  }
);

module.exports = OrderItem;
