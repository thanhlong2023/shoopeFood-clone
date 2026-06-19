const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UserAddress = sequelize.define(
  "UserAddress",
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    label: { type: DataTypes.STRING(50), allowNull: true },
    placeId: { type: DataTypes.STRING(255), allowNull: true, field: "place_id" },
    formattedAddress: { type: DataTypes.TEXT, allowNull: false, field: "formatted_address" },
    latitude: { type: DataTypes.DOUBLE, allowNull: false },
    longitude: { type: DataTypes.DOUBLE, allowNull: false },
    province: { type: DataTypes.STRING(100), allowNull: true },
    district: { type: DataTypes.STRING(100), allowNull: true },
    ward: { type: DataTypes.STRING(100), allowNull: true },
    street: { type: DataTypes.STRING(255), allowNull: true },
    houseNumber: { type: DataTypes.STRING(50), allowNull: true, field: "house_number" },
    note: { type: DataTypes.TEXT, allowNull: true },
    provider: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "vietmap" },
    createdAt: { type: DataTypes.DATE, field: "created_at" },
  },
  {
    tableName: "user_addresses",
    timestamps: true,
    updatedAt: false,
    indexes: [
      { name: "idx_user_addresses_user_id", fields: ["user_id"] },
      { name: "idx_user_addresses_place_id", fields: ["place_id"] },
    ],
  }
);

module.exports = UserAddress;
