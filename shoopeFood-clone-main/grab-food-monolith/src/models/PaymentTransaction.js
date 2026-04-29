const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PaymentTransaction = sequelize.define(
  "PaymentTransaction",
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    paymentId: { type: DataTypes.BIGINT, allowNull: false, field: "payment_id" },
    attemptNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: "attempt_number" },
    status: { type: DataTypes.ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'RETRYING'), defaultValue: 'PENDING' },
    transactionRef: { type: DataTypes.STRING(100), field: "transaction_ref" },
    gatewayResponse: { type: DataTypes.JSON, field: "gateway_response" },
    createdAt: { type: DataTypes.DATE, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, field: "updated_at" },
  },
  {
    tableName: "payment_transactions",
    timestamps: true,
  }
);

module.exports = PaymentTransaction;
