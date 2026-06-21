const mysql = require("mysql2/promise");
const { DataTypes } = require("sequelize");
const { sequelize, DriverLocation, Food, User, Role, UserRole } = require("../models");
const { setUserRole } = require("../utils/roleAssignment");
const { encodeGeohash } = require("../utils/geohash");
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

const tableNameMatches = (table, tableName) => {
  if (typeof table === "string") {
    return table === tableName;
  }

  return Object.values(table || {}).some((value) => value === tableName);
};

const tableExists = async (tableName) => {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => tableNameMatches(table, tableName));
};

const ensureIndex = async (tableName, indexName, fields) => {
  const queryInterface = sequelize.getQueryInterface();
  const indexes = await queryInterface.showIndex(tableName);

  if (indexes.some((index) => index.name === indexName)) {
    return;
  }

  try {
    await queryInterface.addIndex(tableName, fields, { name: indexName });
  } catch (error) {
    console.warn(`Could not add index ${indexName}:`, error.message);
  }
};

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

const ensureFoodImageUrlColumn = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("food_items");

  if (!hasColumn(columns, "image_url")) {
    await queryInterface.addColumn("food_items", "image_url", {
      type: DataTypes.STRING(255),
      allowNull: true,
    });
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

  if (!hasColumn(columns, "deleted_at")) {
    await queryInterface.addColumn("food_items", "deleted_at", {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }
};

const ensureToppingQuantityColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("toppings");

  if (!hasColumn(columns, "default_quantity")) {
    await queryInterface.addColumn("toppings", "default_quantity", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  }

  if (!hasColumn(columns, "current_quantity")) {
    await queryInterface.addColumn("toppings", "current_quantity", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  }

  if (!hasColumn(columns, "quantity_reset_date")) {
    await queryInterface.addColumn("toppings", "quantity_reset_date", {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
  }

  if (!hasColumn(columns, "start_date")) {
    await queryInterface.addColumn("toppings", "start_date", {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
  }

  if (!hasColumn(columns, "end_date")) {
    await queryInterface.addColumn("toppings", "end_date", {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
  }

  if (!hasColumn(columns, "deleted_at")) {
    await queryInterface.addColumn("toppings", "deleted_at", {
      type: DataTypes.DATE,
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

  if (!hasColumn(columns, "geohash")) {
    await queryInterface.addColumn("driver_locations", "geohash", {
      type: DataTypes.STRING(12),
      allowNull: true,
    });
  }

  await ensureIndex("driver_locations", "idx_driver_locations_geohash", ["geohash"]);
};

const ensureDriverLocationTrackingColumnsBeforeSync = async () => {
  if (!(await tableExists("driver_locations"))) {
    return;
  }

  await ensureDriverLocationTrackingColumns();
};

const backfillDriverLocationGeohashes = async () => {
  const locations = await DriverLocation.findAll({
    where: { geohash: null },
    attributes: ["id", "latitude", "longitude", "geohash"],
    limit: 1000,
  });

  await Promise.all(
    locations.map((location) => {
      const geohash = encodeGeohash(location.latitude, location.longitude);
      if (!geohash) {
        return Promise.resolve();
      }

      return location.update({ geohash });
    })
  );
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

const ensureOrderIdempotencyUniqueIndex = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const indexes = await queryInterface.showIndex("orders");
  const hasUniqueIdempotencyIndex = indexes.some(
    (index) =>
      index.unique &&
      (index.fields || []).some((field) => field.attribute === "idempotency_key" || field.name === "idempotency_key")
  );

  if (hasUniqueIdempotencyIndex) {
    return;
  }

  try {
    await queryInterface.addIndex("orders", ["idempotency_key"], {
      unique: true,
      name: "uniq_orders_idempotency_key",
    });
  } catch (error) {
    console.warn("Could not add unique index for orders.idempotency_key:", error.message);
  }
};

const ensureOrderCancellationColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("orders");

  if (!hasColumn(columns, "cancel_reason")) {
    await queryInterface.addColumn("orders", "cancel_reason", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  }

  if (!hasColumn(columns, "cancelled_by_role")) {
    await queryInterface.addColumn("orders", "cancelled_by_role", {
      type: DataTypes.STRING(20),
      allowNull: true,
    });
  }

  if (!hasColumn(columns, "cancelled_by_user_id")) {
    await queryInterface.addColumn("orders", "cancelled_by_user_id", {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
  }

  if (!hasColumn(columns, "cancelled_at")) {
    await queryInterface.addColumn("orders", "cancelled_at", {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }
};

const ensureOrderStatusChangedAtColumn = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("orders");

  if (!hasColumn(columns, "status_changed_at")) {
    await queryInterface.addColumn("orders", "status_changed_at", {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
    });
  }

  await sequelize.query(`
    UPDATE orders
    SET status_changed_at = COALESCE(status_changed_at, created_at, CURRENT_TIMESTAMP)
    WHERE status_changed_at IS NULL
  `);
};

const ensureDriverApprovalColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("driver_details");

  if (!hasColumn(columns, "id_card_number")) {
    await queryInterface.addColumn("driver_details", "id_card_number", {
      type: DataTypes.STRING(20),
      allowNull: true,
    });
  }

  if (!hasColumn(columns, "approval_status")) {
    await queryInterface.addColumn("driver_details", "approval_status", {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "APPROVED",
    });
  }

  if (!hasColumn(columns, "reject_reason")) {
    await queryInterface.addColumn("driver_details", "reject_reason", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  }
};

const ROLE_PRIORITY = {
  ADMIN: 4,
  MERCHANT: 3,
  DRIVER: 2,
  CUSTOMER: 1,
};

const ensureSingleRolePerUser = async () => {
  const users = await User.findAll({
    include: [{ model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } }],
  });

  await Promise.all(
    users.map(async (user) => {
      const roleNames = (user.roles || []).map((role) => role.name);
      if (roleNames.length <= 1) {
        return;
      }

      const keeper = roleNames.sort((left, right) => (ROLE_PRIORITY[right] || 0) - (ROLE_PRIORITY[left] || 0))[0];
      const role = await Role.findOne({ where: { name: keeper } });
      if (!role) {
        return;
      }

      await UserRole.destroy({ where: { userId: user.id } });
      await UserRole.create({ userId: user.id, roleId: role.id });
    }),
  );
};

const ensureDemoRoleAssignments = async () => {
  const adminRole = await Role.findOne({ where: { name: "ADMIN" } });
  if (!adminRole) {
    return;
  }

  const [customerDemo, adminUser] = await Promise.all([
    User.findOne({ where: { phone: "0900000001" } }),
    User.findOne({ where: { phone: "0900000005" } }),
  ]);

  if (customerDemo) {
    const customerRoles = await UserRole.findAll({ where: { userId: customerDemo.id } });
    const hasWrongAdmin =
      customerRoles.some((item) => Number(item.roleId) === Number(adminRole.id)) && customerRoles.length > 1;

    if (hasWrongAdmin || (customerRoles.length === 1 && Number(customerRoles[0].roleId) === Number(adminRole.id))) {
      await setUserRole(customerDemo.id, "CUSTOMER");
    }
  }

  if (adminUser) {
    await setUserRole(adminUser.id, "ADMIN");
  }
};

const ensureOrderNoteColumn = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("orders");

  if (!hasColumn(columns, "note")) {
    await queryInterface.addColumn("orders", "note", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  }
};

const initializeDatabase = async () => {
  await ensureDatabaseExists();
  await sequelize.authenticate();
  await ensureDriverLocationTrackingColumnsBeforeSync();
  await sequelize.sync();
  await ensureFoodQuantityColumns();
  await ensureToppingQuantityColumns();
  await ensureFoodImageUrlColumn();
  await ensureUsersCreatedAtColumn();
  await ensureDriverLocationTrackingColumns();
  await backfillDriverLocationGeohashes();
  await ensureDriverApprovalColumns();
  await ensureRestaurantApprovalColumns();
  await ensureOrderItemSnapshotColumns();
  await ensureOrderIdempotencyUniqueIndex();
  await ensureOrderCancellationColumns();
  await ensureOrderStatusChangedAtColumn();
  await ensureOrderNoteColumn();
  await ensureSingleRolePerUser();
  await ensureDemoRoleAssignments();
  await Food.resetExpiredDailyQuantities();
  await require("../models/Topping").resetExpiredDailyQuantities();
  await seedService.seedIfEmpty();
};

module.exports = {
  initializeDatabase,
  ensureDatabaseExists,
  ensureFoodQuantityColumns,
  ensureToppingQuantityColumns,
  ensureUsersCreatedAtColumn,
  ensureDriverLocationTrackingColumns,
  backfillDriverLocationGeohashes,
  ensureOrderItemSnapshotColumns,
  ensureOrderCancellationColumns,
  ensureOrderStatusChangedAtColumn,
};
