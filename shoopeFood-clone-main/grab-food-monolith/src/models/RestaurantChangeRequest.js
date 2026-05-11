const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const RestaurantChangeRequest = sequelize.define(
  "RestaurantChangeRequest",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    restaurantId: { type: DataTypes.INTEGER, allowNull: false, field: "restaurant_id" },
    requestedBy: { type: DataTypes.INTEGER, allowNull: false, field: "requested_by" },
    payload: { type: DataTypes.JSON, allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "PENDING" },
    reviewedBy: { type: DataTypes.INTEGER, field: "reviewed_by" },
    reviewedAt: { type: DataTypes.DATE, field: "reviewed_at" },
    rejectReason: { type: DataTypes.TEXT, field: "reject_reason" },
  },
  {
    tableName: "restaurant_change_requests",
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = RestaurantChangeRequest;
