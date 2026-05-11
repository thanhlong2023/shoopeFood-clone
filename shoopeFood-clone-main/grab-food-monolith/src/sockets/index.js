const { Server } = require("socket.io");

let io;

module.exports = {
  init: (httpServer) => {
    io = new Server(httpServer);

    io.on("connection", (socket) => {
      console.log("Client connected:", socket.id);

      socket.on("driver:update-location", (payload) => {
        io.emit("driver:location", payload);
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
