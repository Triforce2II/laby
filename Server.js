var conf = require("./config.json");
var WebSocketServer = require("ws").Server;
var myHttp = require("http");
var express = require("express");
var app = express();
var server = myHttp.createServer(app).listen(conf.port);

app.use(express.static(__dirname + "/public"));

app.get("/", function(req, res) {
    res.sendfile(__dirname + "/public/index.html");
});

var wss = new WebSocketServer({
    server
});

wss.on('connection', function(ws) {
    ws.on('message', function(message) {
        console.log('received: %s', message);
    });
    ws.send('something');
});
