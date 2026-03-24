const { Server } = require("socket.io");

module.exports = (httpServer) => {
  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("driver:update-location", (payload) => {
      io.emit("driver:location", payload);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};
