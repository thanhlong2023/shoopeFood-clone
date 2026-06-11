require("dotenv").config();
const http = require("http");
const app = require("./src/app");
const socketManager = require("./src/sockets");
const { initializeDatabase } = require("./src/services/databaseInitializer");
const { scheduleDailyFoodQuantityReset } = require("./src/services/foodQuantityResetService");
const { schedulePendingOrderTimeoutSweep } = require("./src/services/orderTimeoutService");

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

socketManager.init(server);

const bootstrap = async () => {
  try {
    await initializeDatabase();
    console.log("Database initialized successfully");

    scheduleDailyFoodQuantityReset();
    schedulePendingOrderTimeoutSweep();

    server.listen(PORT, () => {
      console.log(`GrabFood monolith is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Cannot connect database:", error.message);
    if (error.parent?.sqlMessage) {
      console.error("SQL:", error.parent.sqlMessage);
    }
    process.exit(1);
  }
};

bootstrap();
