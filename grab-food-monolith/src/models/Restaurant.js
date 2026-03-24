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
    isOpen: { type: DataTypes.BOOLEAN, field: "is_open", defaultValue: true },
    imageUrl: { type: DataTypes.STRING, field: "image_url" },
    ratingAvg: { type: DataTypes.DECIMAL(3, 2), field: "rating_avg", defaultValue: 5.0 },
  },
  {
    tableName: "restaurants",
    createdAt: false,
    updatedAt: false,
  }
);

module.exports = Restaurant;
