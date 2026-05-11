const sequelize = require("../config/database");
const User = require("./User");
const Role = require("./Role");
const UserRole = require("./UserRole");
const DriverDetail = require("./DriverDetail");
const DriverLocation = require("./DriverLocation");
const Restaurant = require("./Restaurant");
const RestaurantChangeRequest = require("./RestaurantChangeRequest");
const Order = require("./Order");
const OrderItem = require("./OrderItem");
const OrderStatus = require("./OrderStatus");
const Food = require("./Food");
const Category = require("./Category");
const Payment = require("./Payment");
const PaymentTransaction = require("./PaymentTransaction");

User.belongsToMany(Role, { through: UserRole, foreignKey: "userId", otherKey: "roleId", as: "roles" });
Role.belongsToMany(User, { through: UserRole, foreignKey: "roleId", otherKey: "userId", as: "users" });

User.hasOne(DriverDetail, { foreignKey: "userId", sourceKey: "id", as: "driverDetail" });
DriverDetail.belongsTo(User, { foreignKey: "userId", targetKey: "id", as: "driverUser" });

User.hasMany(DriverLocation, { foreignKey: "driverId", sourceKey: "id", as: "driverLocations" });
DriverLocation.belongsTo(User, { foreignKey: "driverId", targetKey: "id", as: "driverUser" });

User.hasMany(Order, { foreignKey: "customerId", sourceKey: "id" });
Order.belongsTo(User, { foreignKey: "customerId", targetKey: "id", as: "customerUser" });

Restaurant.hasMany(Order, { foreignKey: "restaurantId", sourceKey: "id" });
Order.belongsTo(Restaurant, { foreignKey: "restaurantId", targetKey: "id" });

Restaurant.hasMany(RestaurantChangeRequest, { foreignKey: "restaurantId", sourceKey: "id", as: "changeRequests" });
RestaurantChangeRequest.belongsTo(Restaurant, { foreignKey: "restaurantId", targetKey: "id", as: "restaurant" });

Order.hasMany(DriverLocation, { foreignKey: "orderId", sourceKey: "id", as: "driverLocations" });
DriverLocation.belongsTo(Order, { foreignKey: "orderId", targetKey: "id", as: "order" });

OrderStatus.hasMany(Order, { foreignKey: "statusId", sourceKey: "id" });
Order.belongsTo(OrderStatus, { foreignKey: "statusId", targetKey: "id", as: "statusInfo" });

Restaurant.hasMany(Category, { foreignKey: "restaurantId", sourceKey: "id", as: "categories" });
Category.belongsTo(Restaurant, { foreignKey: "restaurantId", targetKey: "id", as: "restaurant" });

Category.hasMany(Food, { foreignKey: "categoryId", sourceKey: "id", as: "foods" });
Food.belongsTo(Category, { foreignKey: "categoryId", targetKey: "id", as: "category" });

Order.hasMany(OrderItem, { foreignKey: "orderId", sourceKey: "id", as: "items" });
OrderItem.belongsTo(Order, { foreignKey: "orderId", targetKey: "id", as: "order" });

Food.hasMany(OrderItem, { foreignKey: "foodId", sourceKey: "id", as: "orderItems" });
OrderItem.belongsTo(Food, { foreignKey: "foodId", targetKey: "id", as: "food" });

Order.hasOne(Payment, { foreignKey: "orderId", sourceKey: "id", as: "payment" });
Payment.belongsTo(Order, { foreignKey: "orderId", targetKey: "id" });

Payment.hasMany(PaymentTransaction, { foreignKey: "paymentId", sourceKey: "id", as: "transactions" });
PaymentTransaction.belongsTo(Payment, { foreignKey: "paymentId", targetKey: "id" });

module.exports = {
  sequelize,
  User,
  Role,
  UserRole,
  DriverDetail,
  DriverLocation,
  Restaurant,
  RestaurantChangeRequest,
  Order,
  OrderItem,
  OrderStatus,
  Category,
  Food,
  Payment,
  PaymentTransaction,
};
