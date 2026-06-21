const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const OrderItemTopping = sequelize.define(
  "OrderItemTopping",
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    orderItemId: { type: DataTypes.BIGINT, allowNull: false, field: "order_item_id" },
    toppingId: { type: DataTypes.INTEGER, allowNull: false, field: "topping_id" },
    toppingName: { type: DataTypes.STRING(255), allowNull: false, field: "topping_name" },
    priceAtOrder: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: "price_at_order" },
    quantity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 }, defaultValue: 1 },
  },
  {
    tableName: "order_item_toppings",
    createdAt: false,
    updatedAt: false,
    indexes: [
      { name: "idx_order_item_toppings_order_item_id", fields: ["order_item_id"] },
    ],
  }
);

module.exports = OrderItemTopping;
