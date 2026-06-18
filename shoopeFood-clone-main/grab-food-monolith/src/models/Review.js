const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Review = sequelize.define(
  "Review",
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    orderId: { type: DataTypes.BIGINT, allowNull: false, field: "order_id" },
    customerId: { type: DataTypes.INTEGER, allowNull: false, field: "customer_id" },
    targetType: { type: DataTypes.ENUM("RESTAURANT", "DRIVER"), allowNull: false, field: "target_type" },
    targetId: { type: DataTypes.INTEGER, allowNull: false, field: "target_id" },
    rating: { type: DataTypes.TINYINT, allowNull: false },
    comment: { type: DataTypes.TEXT },
    createdAt: { type: DataTypes.DATE, field: "created_at" },
  },
  {
    tableName: "reviews",
    timestamps: true,
    updatedAt: false,
    indexes: [{ unique: true, fields: ["order_id", "target_type"], name: "unique_order_target" }],
  }
);

module.exports = Review;
