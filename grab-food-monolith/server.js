require("dotenv").config();
const http = require("http");
const app = require("./src/app");
const initSockets = require("./src/sockets");
const { sequelize } = require("./src/models");

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

initSockets(server);

const bootstrap = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected successfully");

    server.listen(PORT, () => {
      console.log(`GrabFood monolith is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Cannot connect database:", error.message);
    process.exit(1);
  }
};

bootstrap();
