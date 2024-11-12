// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const WebSocket = require("ws");
const socketRoute = require("./routes/socket.route");
const { app1Router, factory } = require("./whot_server");
const { app2Router } = require("./draught_server");
const { draughtSocketRoute } = require("./draughtSocketRoute");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Mount each app's router on a different path
app.use("/whot", app1Router);
app.use("/draughts", app2Router);

const wss1 = socketRoute(app1Router, factory);

// WebSocket server for draughts using 'ws' package
const wss = draughtSocketRoute();

// Handle upgrading requests for WebSocket connections on the `/draughts` route
server.on("upgrade", (request, socket, head) => {
  const pathname = request.url;
  if (pathname === "/draughts/") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else if (pathname.split("/")[1] === "whot") {
    wss1.handleUpgrade(request, socket, head, (ws) => {
      wss1.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Start the server
const PORT = process.env.PORT || 8800;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
