const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    fullName: { type: DataTypes.STRING(100), field: "full_name" },
    phone: { type: DataTypes.STRING(15), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    ratingAvg: { type: DataTypes.DECIMAL(3, 2), field: "rating_avg", defaultValue: 5.0 },
    createdAt: { type: DataTypes.DATE, field: "created_at" },
  },
  {
    tableName: "users",
    timestamps: true,
    updatedAt: false,
  }
);

module.exports = User;
