const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const DriverLocation = sequelize.define(
  "DriverLocation",
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    driverId: { type: DataTypes.INTEGER, allowNull: false, field: "driver_id" },
    orderId: { type: DataTypes.BIGINT, field: "order_id" },
    latitude: { type: DataTypes.DOUBLE, allowNull: false },
    longitude: { type: DataTypes.DOUBLE, allowNull: false },
    geohash: { type: DataTypes.STRING(12) },
    heading: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
    speedKmh: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 24, field: "speed_kmh" },
    createdAt: { type: DataTypes.DATE, field: "created_at" },
  },
  {
    tableName: "driver_locations",
    timestamps: true,
    updatedAt: false,
    indexes: [
      { name: "idx_driver_locations_driver_id", fields: ["driver_id"] },
      { name: "idx_driver_locations_order_id", fields: ["order_id"] },
      { name: "idx_driver_locations_geohash", fields: ["geohash"] },
      { name: "idx_driver_locations_created_at", fields: ["created_at"] },
    ],
  }
);

module.exports = DriverLocation;
