const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const OrderStatus = sequelize.define(
  "OrderStatus",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    label: { type: DataTypes.STRING(100) },
    description: { type: DataTypes.TEXT },
    sortOrder: { type: DataTypes.INTEGER, field: "sort_order", defaultValue: 0 },
  },
  {
    tableName: "order_statuses",
    createdAt: false,
    updatedAt: false,
  }
);

module.exports = OrderStatus;
