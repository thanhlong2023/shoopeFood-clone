const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const FoodTopping = sequelize.define(
  "FoodTopping",
  {
    foodId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, field: "food_id" },
    toppingId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, field: "topping_id" },
  },
  {
    tableName: "food_toppings",
    createdAt: false,
    updatedAt: false,
  }
);

module.exports = FoodTopping;
