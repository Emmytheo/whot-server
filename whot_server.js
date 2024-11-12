// app1/index.js
const express = require('express');
const bodyParser = require('body-parser');
const GameFactory = require('./factories/game.factory');
const indexRoute = require('./routes/index.route');
const gameRoute = require('./routes/game.route');

const factory = new GameFactory();
const app1Router = express.Router();

app1Router.use(bodyParser.json());
app1Router.use(bodyParser.urlencoded({ extended: false }));
app1Router.use(require('./utils/cross-domain'));

app1Router.use('/', indexRoute);
app1Router.use('/games', gameRoute(factory));

module.exports = { app1Router, factory };
