const sequelize = require("../config/database");
const User = require("./User");
const DriverDetail = require("./DriverDetail");
const Restaurant = require("./Restaurant");
const Order = require("./Order");
const OrderStatus = require("./OrderStatus");
const Food = require("./Food");
const Category = require("./Category");

User.hasOne(DriverDetail, { foreignKey: "userId", sourceKey: "id", as: "driverDetail" });
DriverDetail.belongsTo(User, { foreignKey: "userId", targetKey: "id", as: "driverUser" });

User.hasMany(Order, { foreignKey: "customerId", sourceKey: "id" });
Order.belongsTo(User, { foreignKey: "customerId", targetKey: "id", as: "customerUser" });

Restaurant.hasMany(Order, { foreignKey: "restaurantId", sourceKey: "id" });
Order.belongsTo(Restaurant, { foreignKey: "restaurantId", targetKey: "id" });

OrderStatus.hasMany(Order, { foreignKey: "statusId", sourceKey: "id" });
Order.belongsTo(OrderStatus, { foreignKey: "statusId", targetKey: "id", as: "statusInfo" });

Restaurant.hasMany(Category, { foreignKey: "restaurantId", sourceKey: "id", as: "categories" });
Category.belongsTo(Restaurant, { foreignKey: "restaurantId", targetKey: "id", as: "restaurant" });

Category.hasMany(Food, { foreignKey: "categoryId", sourceKey: "id", as: "foods" });
Food.belongsTo(Category, { foreignKey: "categoryId", targetKey: "id", as: "category" });

module.exports = {
  sequelize,
  User,
  DriverDetail,
  Restaurant,
  Order,
  OrderStatus,
  Category,
  Food,
};
