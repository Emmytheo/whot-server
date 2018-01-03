const express = require('express')
const router = express.Router()
const expressWs = require('express-ws')
const Game = require('whot')
const GameFactory = require('../factories/game.factory')
const logger = require('../logger')('socket.route.js')

const Events = {
    GAME_CREATE: 'game:create',
    GAME_START: 'game:start',
    PLAYER_HAND: 'player:hand',
    TURN_SWITCH: 'turn:switch',
    MARKET_PICK: 'market:pick'
}

const extendWs = require('../prototypes/ws.prototype')

const wsErrorHandler = (err) => {
    if (err) logger.error("ws-error", err)
}

const errorThrow = (err, ws) => {
    logger.error(err)
    if (ws) {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                error: err
            }), wsErrorHandler)
        }
    }
}

const playTurn = (game) => {
    const player = game.turn.next()
    if (player.canPlay()) {
        player.socket.json({ message: Events.TURN_SWITCH })
    }
    else {
        //pick cards from the market and switch to the next player
        player.socket.json({ message: Events.MARKET_PICK, cards: player.pick() })
        game.turn.switch()
        playTurn(game)
    }
}

module.exports = (app, factory = new GameFactory()) => {
    expressWs(app)
    
    factory.create(new Game({ noOfPlayers: 4 })) //ONLY FOR TESTS

    app.ws('/game/:id', (ws, req) => {
        extendWs(ws)

        try {
            const id = req.params.id 
            const instance = factory.get(id)
            if (instance) {
                const game = instance.game

                /**
                 * ws.id is player id
                 * ws.type is player type
                 */
                
                if (!(ws.id && ws.type)) {
                    if (instance.sockets.players.length < game.turn.count() && instance.sockets.players.indexOf(ws) < 0) {
                        ws.id = instance.sockets.players.length + 1
                        ws.type = 'player'
                        instance.sockets.players.push(ws)
                        game.turn.all((player) => {
                            if (!player.socket) {
                                player.socket = instance.sockets.players.find((socket) => socket.id === player.id)
                            }
                        })
                    }
                    else {
                        ws.id = instance.sockets.listeners.length + 1
                        ws.type = 'listener'
                        instance.sockets.listeners.push(ws)
                    }
                }

                //onopen
                ws.json(Object.assign({ id, message: Events.GAME_CREATE, playerId: ws.id, type: ws.type }, instance.sockets.stats()))

                //start game
                if (instance.sockets.players.length === game.turn.count() && instance.sockets.listeners.length === 0) {
                    instance.sockets.broadcast({ message: Events.GAME_START, pile: game.pile.top() })
                    game.turn.all((player) => {
                        player.socket.json({ message: Events.PLAYER_HAND, hand: player.hand() })
                    })
                    
                    playTurn(game)
                }
        
                //onmessage
                ws.on('message', (message = '') => {
                    const messageData = JSON.parse(message)
                    switch (messageData.message) {
                        case 'player:play':
                            if (game.turn.next().id === ws.id) {
                                const player = game.turn.next()
                                const cardIndex = messageData.index
                                const iNeed = messageData.iNeed
                                if (cardIndex >= 0 && cardIndex < player.hand().length) {
                                    const card = player.play(cardIndex, iNeed)
                                    instance.sockets.broadcast({ message: 'player:play', id: ws.id, card }, ws) //broadcast to all except current ws
                                    ws.json({ message: 'player:hand', hand: player.hand() })
                                    game.turn.execute(game.pile.top())
                                    playTurn(game)
                                }
                                else {
                                    errorThrow('error:invalid-card-index', ws)
                                }
                            }
                            else {
                                errorThrow('error:player-out-of-turn', ws)
                            }
                        break;
                    }
                })
            }
            else {
                errorThrow('could not find a game with id "' + id + '"', ws)
            }
        }
        catch (ex) {
            logger.error(ex)
        }
    })
}