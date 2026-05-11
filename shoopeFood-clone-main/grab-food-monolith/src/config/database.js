const { Sequelize } = require("sequelize");

const getEnv = (key, fallbackValue) =>
  Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : fallbackValue;

const sequelize = new Sequelize(
  getEnv("DB_NAME", "grabfood_db"),
  getEnv("DB_USER", "root"),
  getEnv("DB_PASSWORD", "123456"),
  {
    host: getEnv("DB_HOST", "localhost"),
    port: Number(getEnv("DB_PORT", 3306)) || 3306,
    dialect: getEnv("DB_DIALECT", "mysql"),
    logging: false,
  }
);

module.exports = sequelize;
