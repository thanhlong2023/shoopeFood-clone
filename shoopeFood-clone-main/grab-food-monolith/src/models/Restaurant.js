const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Restaurant = sequelize.define(
  "Restaurant",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    ownerId: { type: DataTypes.INTEGER, allowNull: false, field: "owner_id" },
    name: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.TEXT },
    latitude: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
    longitude: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
<<<<<<< HEAD
    openingTime: { type: DataTypes.TIME, field: "opening_time", defaultValue: "07:00:00" },
    closingTime: { type: DataTypes.TIME, field: "closing_time", defaultValue: "22:00:00" },
    isOpen: { type: DataTypes.BOOLEAN, field: "is_open", defaultValue: true },
    isOpenToday: { type: DataTypes.BOOLEAN, field: "is_open_today", defaultValue: true },
    temporaryClosedReason: { type: DataTypes.TEXT, field: "temporary_closed_reason" },
    temporaryClosedUntil: { type: DataTypes.DATE, field: "temporary_closed_until" },
    imageUrl: { type: DataTypes.STRING, field: "image_url" },
    ratingAvg: { type: DataTypes.DECIMAL(3, 2), field: "rating_avg", defaultValue: 5.0 },
    approvalStatus: { type: DataTypes.STRING(20), field: "approval_status", defaultValue: "PENDING" },
    approvedBy: { type: DataTypes.INTEGER, field: "approved_by" },
    approvedAt: { type: DataTypes.DATE, field: "approved_at" },
    rejectReason: { type: DataTypes.TEXT, field: "reject_reason" },
    deletedAt: { type: DataTypes.DATE, field: "deleted_at" },
=======
    isOpen: { type: DataTypes.BOOLEAN, field: "is_open", defaultValue: true },
    imageUrl: { type: DataTypes.STRING, field: "image_url" },
    ratingAvg: { type: DataTypes.DECIMAL(3, 2), field: "rating_avg", defaultValue: 5.0 },
>>>>>>> origin/main
  },
  {
    tableName: "restaurants",
    createdAt: false,
    updatedAt: false,
  }
);

module.exports = Restaurant;
