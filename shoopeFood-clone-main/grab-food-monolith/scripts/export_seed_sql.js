/**
 * Export current grabfood_db to seed_all_complete.sql
 * Usage: node scripts/export_seed_sql.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const DB_NAME = process.env.DB_NAME || "grabfood_db";
const OUTPUT = path.join(__dirname, "..", "..", "seed_all_complete.sql");

const TABLES_IN_ORDER = [
  "roles",
  "users",
  "user_roles",
  "driver_details",
  "merchant_details",
  "system_settings",
  "vouchers",
  "restaurants",
  "categories",
  "food_items",
  "order_statuses",
  "orders",
  "order_items",
  "payments",
  "payment_transactions",
  "order_status_logs",
  "driver_locations",
  "restaurant_change_requests",
  "reviews",
];

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace("T", " ")}'`;
  }
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function buildCreateTable(row) {
  return row["Create Table"];
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  const lines = [];
  lines.push("SET SQL_SAFE_UPDATES = 0;");
  lines.push("SET FOREIGN_KEY_CHECKS = 0;");
  lines.push("");
  lines.push(`CREATE DATABASE IF NOT EXISTS ${DB_NAME}`);
  lines.push("  CHARACTER SET utf8mb4");
  lines.push("  COLLATE utf8mb4_unicode_ci;");
  lines.push("");
  lines.push(`USE ${DB_NAME};`);
  lines.push("");

  const [tables] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
    [DB_NAME]
  );
  const existingTables = new Set(tables.map((t) => t.TABLE_NAME));

  for (const table of TABLES_IN_ORDER) {
    if (!existingTables.has(table)) continue;
    lines.push(`DROP TABLE IF EXISTS ${table};`);
  }
  for (const { TABLE_NAME: table } of tables) {
    if (!TABLES_IN_ORDER.includes(table)) {
      lines.push(`DROP TABLE IF EXISTS ${table};`);
    }
  }
  lines.push("");

  for (const table of [...TABLES_IN_ORDER, ...[...existingTables].filter((t) => !TABLES_IN_ORDER.includes(t))]) {
    if (!existingTables.has(table)) continue;
    const [createRows] = await connection.query(`SHOW CREATE TABLE \`${DB_NAME}\`.\`${table}\``);
    lines.push(`${createRows[0]["Create Table"]};`);
    lines.push("");
  }

  for (const table of TABLES_IN_ORDER) {
    if (!existingTables.has(table)) continue;
    const [rows] = await connection.query(`SELECT * FROM \`${DB_NAME}\`.\`${table}\``);
    if (rows.length === 0) continue;

    const columns = Object.keys(rows[0]);
    lines.push(`INSERT INTO ${table} (${columns.join(", ")}) VALUES`);

    const valueLines = rows.map((row) => {
      const values = columns.map((col) => sqlValue(row[col]));
      return `(${values.join(", ")})`;
    });
    lines.push(`${valueLines.join(",\n")};`);
    lines.push("");
  }

  lines.push("SET FOREIGN_KEY_CHECKS = 1;");
  lines.push("SET SQL_SAFE_UPDATES = 1;");
  lines.push("");

  fs.writeFileSync(OUTPUT, lines.join("\n"), "utf8");
  await connection.end();

  console.log(`Exported to: ${OUTPUT}`);
  console.log("Next: git add seed_all_complete.sql && git commit && git push");
}

main().catch((error) => {
  console.error("Export failed:", error.message);
  process.exit(1);
});
