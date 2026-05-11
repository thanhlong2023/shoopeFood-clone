const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Category = sequelize.define(
  "Category",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    restaurantId: { type: DataTypes.INTEGER, allowNull: false, field: "restaurant_id" },
    name: { type: DataTypes.STRING(100), allowNull: false },
  },
  {
    tableName: "categories",
    createdAt: false,
    updatedAt: false,
  }
);

module.exports = Category;
