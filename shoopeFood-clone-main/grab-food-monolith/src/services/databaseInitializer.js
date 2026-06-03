const mysql = require("mysql2/promise");
const { DataTypes } = require("sequelize");
const { sequelize, Food } = require("../models");
const seedService = require("./seedService");

const getEnv = (key, fallbackValue) =>
  Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : fallbackValue;

const getDatabaseConfig = () => ({
  database: getEnv("DB_NAME", "grabfood_db"),
  username: getEnv("DB_USER", "root"),
  password: getEnv("DB_PASSWORD", "123456"),
  host: getEnv("DB_HOST", "localhost"),
  port: Number(getEnv("DB_PORT", 3306)) || 3306,
});

const quoteIdentifier = (identifier) => {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error("DB_NAME must contain only letters, numbers, and underscores");
  }

  return `\`${identifier}\``;
};

const hasColumn = (columns, columnName) => Object.prototype.hasOwnProperty.call(columns, columnName);

const ensureDatabaseExists = async () => {
  const config = getDatabaseConfig();
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(config.database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
};

const ensureFoodQuantityColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("food_items");

  if (!hasColumn(columns, "default_quantity")) {
    await queryInterface.addColumn("food_items", "default_quantity", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  }

  if (!hasColumn(columns, "current_quantity")) {
    await queryInterface.addColumn("food_items", "current_quantity", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  }

  if (!hasColumn(columns, "quantity_reset_date")) {
    await queryInterface.addColumn("food_items", "quantity_reset_date", {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
  }
};

const ensureUsersCreatedAtColumn = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("users");

  if (!hasColumn(columns, "created_at")) {
    await queryInterface.addColumn("users", "created_at", {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
    });
  }
};

const ensureDriverLocationTrackingColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("driver_locations");

  if (!hasColumn(columns, "order_id")) {
    await queryInterface.addColumn("driver_locations", "order_id", {
      type: DataTypes.BIGINT,
      allowNull: true,
    });
  }

  if (!hasColumn(columns, "heading")) {
    await queryInterface.addColumn("driver_locations", "heading", {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    });
  }

  if (!hasColumn(columns, "speed_kmh")) {
    await queryInterface.addColumn("driver_locations", "speed_kmh", {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 24,
    });
  }
};

const ensureRestaurantApprovalColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("restaurants");

  if (!hasColumn(columns, "approval_status")) {
    await queryInterface.addColumn("restaurants", "approval_status", {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "PENDING",
    });
  }

  if (!hasColumn(columns, "approved_by")) {
    await queryInterface.addColumn("restaurants", "approved_by", {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
  }

  if (!hasColumn(columns, "approved_at")) {
    await queryInterface.addColumn("restaurants", "approved_at", {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }

  if (!hasColumn(columns, "reject_reason")) {
    await queryInterface.addColumn("restaurants", "reject_reason", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  }
};

const ensureOrderItemSnapshotColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("order_items");

  if (!hasColumn(columns, "food_name")) {
    await queryInterface.addColumn("order_items", "food_name", {
      type: DataTypes.STRING(255),
      allowNull: true,
    });

    await sequelize.query(`
      UPDATE order_items oi
      JOIN food_items fi ON fi.id = oi.food_id
      SET oi.food_name = fi.name
      WHERE oi.food_name IS NULL OR oi.food_name = ''
    `);
  }
};

const initializeDatabase = async () => {
  await ensureDatabaseExists();
  await sequelize.authenticate();
  await sequelize.sync();
  await ensureFoodQuantityColumns();
  await ensureUsersCreatedAtColumn();
  await ensureDriverLocationTrackingColumns();
  await ensureRestaurantApprovalColumns();
  await ensureOrderItemSnapshotColumns();
  await Food.resetExpiredDailyQuantities();
  await seedService.seedIfEmpty();
};

module.exports = {
  initializeDatabase,
  ensureDatabaseExists,
  ensureFoodQuantityColumns,
  ensureUsersCreatedAtColumn,
  ensureDriverLocationTrackingColumns,
  ensureOrderItemSnapshotColumns,
};
