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

<<<<<<< HEAD
const tableExists = async (tableName) => {
  const queryInterface = sequelize.getQueryInterface();

  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

=======
>>>>>>> origin/main
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
<<<<<<< HEAD
  if (!(await tableExists("food_items"))) {
    return;
  }
=======
>>>>>>> origin/main
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
<<<<<<< HEAD
  if (!(await tableExists("users"))) {
    return;
  }
=======
>>>>>>> origin/main
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
<<<<<<< HEAD
  if (!(await tableExists("driver_locations"))) {
    return;
  }
=======
>>>>>>> origin/main
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

<<<<<<< HEAD
const ensureRestaurantApprovalSchema = async () => {
  const queryInterface = sequelize.getQueryInterface();
  if (!(await tableExists("restaurants"))) {
    return;
  }
  const columns = await queryInterface.describeTable("restaurants");

  if (!hasColumn(columns, "opening_time")) {
    await queryInterface.addColumn("restaurants", "opening_time", {
      type: DataTypes.TIME,
      allowNull: true,
      defaultValue: "07:00:00",
    });
  }

  if (!hasColumn(columns, "closing_time")) {
    await queryInterface.addColumn("restaurants", "closing_time", {
      type: DataTypes.TIME,
      allowNull: true,
      defaultValue: "22:00:00",
    });
  }

  if (!hasColumn(columns, "is_open_today")) {
    await queryInterface.addColumn("restaurants", "is_open_today", {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
    });
  }

  if (!hasColumn(columns, "temporary_closed_reason")) {
    await queryInterface.addColumn("restaurants", "temporary_closed_reason", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  }

  if (!hasColumn(columns, "temporary_closed_until")) {
    await queryInterface.addColumn("restaurants", "temporary_closed_until", {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }

  if (!hasColumn(columns, "approval_status")) {
    await queryInterface.addColumn("restaurants", "approval_status", {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "APPROVED",
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

  if (!hasColumn(columns, "deleted_at")) {
    await queryInterface.addColumn("restaurants", "deleted_at", {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }

  await sequelize.query(
    "UPDATE restaurants SET approval_status = 'APPROVED', is_open_today = COALESCE(is_open_today, 1) WHERE approval_status IS NULL"
  );
};

const initializeDatabase = async () => {
  await ensureDatabaseExists();
  await sequelize.authenticate();
  await ensureDriverLocationTrackingColumns();
  await ensureFoodQuantityColumns();
  await sequelize.sync();
  await ensureRestaurantApprovalSchema();
=======
const initializeDatabase = async () => {
  await ensureDatabaseExists();
  await sequelize.authenticate();
  await sequelize.sync();
>>>>>>> origin/main
  await ensureFoodQuantityColumns();
  await ensureUsersCreatedAtColumn();
  await ensureDriverLocationTrackingColumns();
  await Food.resetExpiredDailyQuantities();
  await seedService.seedIfEmpty();
};

module.exports = {
  initializeDatabase,
  ensureDatabaseExists,
  ensureFoodQuantityColumns,
  ensureUsersCreatedAtColumn,
  ensureDriverLocationTrackingColumns,
<<<<<<< HEAD
  ensureRestaurantApprovalSchema,
  tableExists,
=======
>>>>>>> origin/main
};
