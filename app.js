// http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/
"use strict";

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-tiles';

// Port where we'll run the websocket server
var webSocketsServerPort = process.env.PORT || 5000;

// websocket and http servers
var WebSocketServer = require('ws').Server;
var http = require('http');
var url = require("url");
var st = require('node-static');

/**
 * Global variables
 */
// latest 100 messages
var history = [ ];
// list of currently connected clients (users)
var clients = [ ];

/**
 * Helper function for escaping input strings
 */
function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Letter positions array
var tiles = [];
var tile = 0;
for(var s = 0; s < 10; s++) {
    for(var a = 0; a < 26; a++) {
        var tileObj = {
            s: s,
            a: a,
            x: 25 + (a * 30),
            y: 25 + (s * 30),
            id: tile++,
            letter: 'abcdefghijklmnopqrstuvwxyz'[a]
        };

        tiles.push(tileObj);
    }
}

// Array with some colors
var colors = [ 'red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange' ];
// ... in random order
colors.sort(function(a,b) { return Math.random() > 0.5; } );

var express = require('express');
var path = require('path');

var app = express();

// all environments
app.set('port', webSocketsServerPort);
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

/**
 * HTTP server
 */
var server = http.createServer(app);
server.listen(webSocketsServerPort, function() {
    console.log((new Date()) + " Server is listening on port " + webSocketsServerPort);
});

/**
 * WebSocket server
 */
var wsServer = new WebSocketServer({
    server: server
});

wsServer.on('connection', function(socket) {
    console.log((new Date()) + ' Connection from origin ' + socket.origin + '.');

    var index = clients.push(socket) - 1;
    var userName = false;
    var userColor = false;

    // user sent some message
    socket.on('message', function(message) {
        var inbound = JSON.parse(message);
        if (inbound.type === 'logon') { // accept only text
            if (userName === false) { // first message sent by user is their name
                // remember user name
                userName = inbound.name;
                // get random color and send it back to the user

                console.log((new Date()) + ' User is known as: ' + userName);

                socket.send(JSON.stringify( { type: 'history', data: tiles} ));
            }
        }

        if (inbound.type === 'cds') {
            tiles[inbound.id].x = inbound.x;
            tiles[inbound.id].y = inbound.y;

            var broadcastData = {
                u: userName,
                id: inbound.id,
                x: inbound.x,
                y: inbound.y
            };

            // broadcast message to all connected clients
            var json = JSON.stringify({ type:'cds', data: broadcastData });
            for (var i=0; i < clients.length; i++) {
                clients[i].send(json);
            }
        }
    });

    // user disconnected
    socket.on('close', function(connection) {
        if (userName !== false && userColor !== false) {
            console.log((new Date()) + " Peer "
                + connection.remoteAddress + " disconnected.");
            // remove user from the list of connected clients
            clients.splice(index, 1);
            // push back user's color to be reused by another user
            colors.push(userColor);
        }
    });

});