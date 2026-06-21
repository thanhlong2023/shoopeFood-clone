const { DataTypes, Op } = require("sequelize");
const sequelize = require("../config/database");

const getLocalDateOnly = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const Food = sequelize.define(
  "Food",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    categoryId: { type: DataTypes.INTEGER, field: "category_id" },
    name: { type: DataTypes.STRING, allowNull: false },
    imageUrl: { type: DataTypes.STRING(255), allowNull: true, field: "image_url" },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    isAvailable: { type: DataTypes.BOOLEAN, field: "is_available", defaultValue: true },
    defaultQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "default_quantity",
      validate: { min: 0 },
    },
    currentQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "current_quantity",
      validate: { min: 0 },
    },
    quantityResetDate: {
      type: DataTypes.DATEONLY,
      field: "quantity_reset_date",
    },
    deletedAt: {
      type: DataTypes.DATE,
      field: "deleted_at",
    },
  },
  {
    tableName: "food_items",
    createdAt: false,
    updatedAt: false,
    paranoid: true,
    deletedAt: "deletedAt",
    indexes: [
      { name: "idx_food_items_category", fields: ["category_id"] },
      { name: "idx_food_items_quantity_reset_date", fields: ["quantity_reset_date"] },
    ],
  }
);

Food.getStockDate = getLocalDateOnly;

Food.resetExpiredDailyQuantities = async (options = {}) => {
  const today = Food.getStockDate();

  await Food.update(
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

  return today;
};

Food.beforeValidate((food) => {
  if (food.defaultQuantity === undefined || food.defaultQuantity === null) {
    food.defaultQuantity = 0;
  }

  if (food.currentQuantity === undefined || food.currentQuantity === null) {
    food.currentQuantity = food.defaultQuantity;
  }

  if (!food.quantityResetDate) {
    food.quantityResetDate = Food.getStockDate();
  }
});

module.exports = Food;
