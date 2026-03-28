const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const DriverDetail = sequelize.define(
  "DriverDetail",
  {
    userId: { type: DataTypes.INTEGER, primaryKey: true, field: "user_id" },
    licensePlate: { type: DataTypes.STRING(20), field: "license_plate" },
    vehicleType: { type: DataTypes.STRING(50), field: "vehicle_type" },
    isOnline: { type: DataTypes.BOOLEAN, field: "is_online", defaultValue: false },
  },
  {
    tableName: "driver_details",
    createdAt: false,
    updatedAt: false,
  }
);

module.exports = DriverDetail;