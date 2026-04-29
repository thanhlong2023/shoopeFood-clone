const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Payment = sequelize.define(
  "Payment",
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    orderId: { type: DataTypes.BIGINT, allowNull: false, field: "order_id", unique: true },
    idempotencyKey: { type: DataTypes.STRING(100), allowNull: false, field: "idempotency_key", unique: true },
    paymentMethod: { type: DataTypes.ENUM('CASH', 'E_WALLET', 'CREDIT_CARD'), allowNull: false, field: "payment_method" },
    status: { type: DataTypes.ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'), defaultValue: 'PENDING' },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    createdAt: { type: DataTypes.DATE, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, field: "updated_at" },
  },
  {
    tableName: "payments",
    timestamps: true,
  }
);

module.exports = Payment;
