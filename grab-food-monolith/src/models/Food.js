const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Food = sequelize.define(
  "Food",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    categoryId: { type: DataTypes.INTEGER, field: "category_id" },
    name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    isAvailable: { type: DataTypes.BOOLEAN, field: "is_available", defaultValue: true },
  },
  {
    tableName: "food_items",
    createdAt: false,
    updatedAt: false,
  }
);

module.exports = Food;
