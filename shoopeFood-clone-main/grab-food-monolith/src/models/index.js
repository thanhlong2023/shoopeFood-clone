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
const Review = require("./Review");
const UserAddress = require("./UserAddress");
const Topping = require("./Topping");
const FoodTopping = require("./FoodTopping");
const OrderItemTopping = require("./OrderItemTopping");

User.belongsToMany(Role, { through: UserRole, foreignKey: "userId", otherKey: "roleId", as: "roles" });
Role.belongsToMany(User, { through: UserRole, foreignKey: "roleId", otherKey: "userId", as: "users" });

User.hasOne(DriverDetail, { foreignKey: "userId", sourceKey: "id", as: "driverDetail" });
DriverDetail.belongsTo(User, { foreignKey: "userId", targetKey: "id", as: "driverUser" });

User.hasMany(DriverLocation, { foreignKey: "driverId", sourceKey: "id", as: "driverLocations" });
DriverLocation.belongsTo(User, { foreignKey: "driverId", targetKey: "id", as: "driverUser" });

User.hasMany(Order, { foreignKey: "customerId", sourceKey: "id" });
Order.belongsTo(User, { foreignKey: "customerId", targetKey: "id", as: "customerUser" });

User.hasMany(UserAddress, { foreignKey: "userId", sourceKey: "id", as: "addresses" });
UserAddress.belongsTo(User, { foreignKey: "userId", targetKey: "id", as: "user" });

User.hasMany(Order, { foreignKey: "driverId", sourceKey: "id", as: "driverOrders" });
Order.belongsTo(User, { foreignKey: "driverId", targetKey: "id", as: "driverUser" });

Restaurant.hasMany(Order, { foreignKey: "restaurantId", sourceKey: "id" });
Order.belongsTo(Restaurant, { foreignKey: "restaurantId", targetKey: "id" });

Order.hasMany(DriverLocation, { foreignKey: "orderId", sourceKey: "id", as: "driverLocations" });
DriverLocation.belongsTo(Order, { foreignKey: "orderId", targetKey: "id", as: "order" });

OrderStatus.hasMany(Order, { foreignKey: "statusId", sourceKey: "id" });
Order.belongsTo(OrderStatus, { foreignKey: "statusId", targetKey: "id", as: "statusInfo" });

Restaurant.hasMany(Category, { foreignKey: "restaurantId", sourceKey: "id", as: "categories" });
Category.belongsTo(Restaurant, { foreignKey: "restaurantId", targetKey: "id", as: "restaurant" });

User.hasMany(Restaurant, { foreignKey: "ownerId", sourceKey: "id", as: "restaurants" });
Restaurant.belongsTo(User, { foreignKey: "ownerId", targetKey: "id", as: "owner" });

User.hasMany(RestaurantChangeRequest, { foreignKey: "reviewedBy", sourceKey: "id", as: "reviewedChangeRequests" });
RestaurantChangeRequest.belongsTo(User, { foreignKey: "reviewedBy", targetKey: "id", as: "reviewerUser" });

Restaurant.hasMany(RestaurantChangeRequest, { foreignKey: "restaurantId", sourceKey: "id", as: "changeRequests" });
RestaurantChangeRequest.belongsTo(Restaurant, { foreignKey: "restaurantId", targetKey: "id", as: "restaurant" });

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

Order.hasMany(Review, { foreignKey: "orderId", sourceKey: "id", as: "reviews" });
Review.belongsTo(Order, { foreignKey: "orderId", targetKey: "id", as: "order" });

Restaurant.hasMany(Topping, { foreignKey: "restaurantId", sourceKey: "id", as: "toppings" });
Topping.belongsTo(Restaurant, { foreignKey: "restaurantId", targetKey: "id", as: "restaurant" });

Food.belongsToMany(Topping, { through: FoodTopping, foreignKey: "foodId", otherKey: "toppingId", as: "toppings" });
Topping.belongsToMany(Food, { through: FoodTopping, foreignKey: "toppingId", otherKey: "foodId", as: "foods" });

OrderItem.hasMany(OrderItemTopping, { foreignKey: "orderItemId", sourceKey: "id", as: "toppings" });
OrderItemTopping.belongsTo(OrderItem, { foreignKey: "orderItemId", targetKey: "id", as: "orderItem" });

OrderItemTopping.belongsTo(Topping, { foreignKey: "toppingId", targetKey: "id", as: "toppingInfo" });

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
  Review,
  UserAddress,
  Topping,
  FoodTopping,
  OrderItemTopping,
};
