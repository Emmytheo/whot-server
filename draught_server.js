// app2/index.js
const express = require("express");

const app2Router = express.Router();

app2Router.get("/", (req, res) => {
  res.send("Draughts WebSocket server running");
});

module.exports = { app2Router };
