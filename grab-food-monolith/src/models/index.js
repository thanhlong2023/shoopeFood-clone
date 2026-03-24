const sequelize = require("../config/database");
const User = require("./User");
const Restaurant = require("./Restaurant");
const Order = require("./Order");
const OrderStatus = require("./OrderStatus");
const Food = require("./Food");

User.hasMany(Order, { foreignKey: "customerId", sourceKey: "id" });
Order.belongsTo(User, { foreignKey: "customerId", targetKey: "id", as: "customerUser" });

Restaurant.hasMany(Order, { foreignKey: "restaurantId", sourceKey: "id" });
Order.belongsTo(Restaurant, { foreignKey: "restaurantId", targetKey: "id" });

OrderStatus.hasMany(Order, { foreignKey: "statusId", sourceKey: "id" });
Order.belongsTo(OrderStatus, { foreignKey: "statusId", targetKey: "id", as: "statusInfo" });

module.exports = {
  sequelize,
  User,
  Restaurant,
  Order,
  OrderStatus,
  Food,
};
