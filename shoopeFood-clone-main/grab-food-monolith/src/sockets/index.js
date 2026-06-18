const { Server } = require("socket.io");

let io;

const toPositiveNumber = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

module.exports = {
  init: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      console.log("Client connected:", socket.id);

      socket.on("order:join", (payload = {}) => {
        const orderId = toPositiveNumber(payload.orderId);
        if (orderId) {
          socket.join(`order:${orderId}`);
        }
      });

      socket.on("order:leave", (payload = {}) => {
        const orderId = toPositiveNumber(payload.orderId);
        if (orderId) {
          socket.leave(`order:${orderId}`);
        }
      });

      socket.on("driver:join", (payload = {}) => {
        const driverId = toPositiveNumber(payload.driverId);
        if (driverId) {
          socket.join(`driver:${driverId}`);
        }
      });

      socket.on("driver:leave", (payload = {}) => {
        const driverId = toPositiveNumber(payload.driverId);
        if (driverId) {
          socket.leave(`driver:${driverId}`);
        }
      });

      socket.on("customer:join", (payload = {}) => {
        const customerId = toPositiveNumber(payload.customerId);
        if (customerId) {
          socket.join(`customer:${customerId}`);
        }
      });

      socket.on("driver:update-location", (payload) => {
        const orderId = toPositiveNumber(payload?.orderId);
        const driverId = toPositiveNumber(payload?.driverId);

        if (orderId) {
          io.to(`order:${orderId}`).emit(`order:${orderId}:driver-location`, payload);
        }

        if (driverId) {
          io.to(`driver:${driverId}`).emit("driver:location", payload);
        }
      });

      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
      });
    });
    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error("Socket.io not initialized!");
    }
    return io;
  }
};
