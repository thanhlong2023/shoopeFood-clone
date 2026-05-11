const socket = io();

socket.on("driver:location", (payload) => {
  const tracker = document.getElementById("tracker");
  if (tracker) {
    tracker.textContent = `Driver ${payload.driverId}: ${payload.lat}, ${payload.lng}`;
  }
});
