const sequelize = require("../config/database");
const User = require("./User");
const Restaurant = require("./Restaurant");
const Order = require("./Order");
const Food = require("./Food");

User.hasMany(Order, { foreignKey: "customerId", sourceKey: "id" });
Order.belongsTo(User, { foreignKey: "customerId", targetKey: "id", as: "customerUser" });

Restaurant.hasMany(Order, { foreignKey: "restaurantId", sourceKey: "id" });
Order.belongsTo(Restaurant, { foreignKey: "restaurantId", targetKey: "id" });

module.exports = {
  sequelize,
  User,
  Restaurant,
  Order,
  Food,
};
