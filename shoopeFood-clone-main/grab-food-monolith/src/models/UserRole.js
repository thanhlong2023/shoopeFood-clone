const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UserRole = sequelize.define(
  "UserRole",
  {
    userId: { type: DataTypes.INTEGER, primaryKey: true, field: "user_id" },
    roleId: { type: DataTypes.INTEGER, primaryKey: true, field: "role_id" },
  },
  {
    tableName: "user_roles",
    timestamps: false,
  }
);

module.exports = UserRole;
