const { DataTypes, Op } = require("sequelize");
const sequelize = require("../config/database");

const getLocalDateOnly = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const Topping = sequelize.define(
  "Topping",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    restaurantId: { type: DataTypes.INTEGER, allowNull: false, field: "restaurant_id" },
    name: { type: DataTypes.STRING(255), allowNull: false },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    isAvailable: { type: DataTypes.BOOLEAN, field: "is_available", defaultValue: true },
    defaultQuantity: { type: DataTypes.INTEGER, field: "default_quantity", allowNull: false, defaultValue: 0 },
    currentQuantity: { type: DataTypes.INTEGER, field: "current_quantity", allowNull: false, defaultValue: 0 },
    quantityResetDate: { type: DataTypes.DATEONLY, field: "quantity_reset_date" },
    startDate: { type: DataTypes.DATEONLY, field: "start_date" },
    endDate: { type: DataTypes.DATEONLY, field: "end_date" },
    deletedAt: { type: DataTypes.DATE, field: "deleted_at" },
  },
  {
    tableName: "toppings",
    createdAt: false,
    updatedAt: false,
    paranoid: true,
    deletedAt: "deletedAt",
  }
);

Topping.getStockDate = getLocalDateOnly;

Topping.resetExpiredDailyQuantities = async (options = {}) => {
  const today = Topping.getStockDate();

  await Topping.update(
    {
      currentQuantity: sequelize.literal("default_quantity"),
      quantityResetDate: today,
    },
    {
      ...options,
      where: {
        [Op.or]: [
          { quantityResetDate: null },
          { quantityResetDate: { [Op.lt]: today } },
        ],
      },
    }
  );

  await Topping.update(
    {
      isAvailable: false,
    },
    {
      ...options,
      where: {
        isAvailable: true,
        endDate: { [Op.lt]: today },
      },
    }
  );

  return today;
};

Topping.beforeValidate((topping) => {
  if (topping.defaultQuantity === undefined || topping.defaultQuantity === null) {
    topping.defaultQuantity = 0;
  }

  if (topping.currentQuantity === undefined || topping.currentQuantity === null) {
    topping.currentQuantity = topping.defaultQuantity;
  }

  if (!topping.quantityResetDate) {
    topping.quantityResetDate = Topping.getStockDate();
  }
});

module.exports = Topping;
