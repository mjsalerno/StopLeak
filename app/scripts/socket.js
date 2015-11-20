'use strict';
/*global $*/

var DB_HOST = '127.0.0.1';
var DB_PORT = '8765';

/* Create the websocket and message handling. */
var socket = null;
/* Deferred Object to send only when open. */
var socketDeferred = $.Deferred();

function webSocketReceive(event) {
    var message = JSON.parse(event.data);
    switch (message.type) {
        case 'get_counts':
            //var results = message.value;
            //displayCounts(results.block, results.scrub, results.allow);
            console.log('Store counts to give to popup: ' + event.data);
            break;
        default:
            console.log('Unsupported event: ' + message.type + ' received.');
            break;
    }
}

function setupWebSocket(socketDeferred) {
    var socket = new WebSocket('ws://' + DB_HOST + ':' + DB_PORT);

    socket.onopen = function() {
        socketDeferred.resolve();
    };
    socket.onerror = function() {
        socketDeferred.reject();
    };
    socket.onclose = function() {
        socketDeferred.reject();
    };
    socket.onmessage = webSocketReceive;
    return socket;
}

socket = setupWebSocket(socketDeferred);

function sendCountsRequest(domains) {
    // Build the payload
    var request = {
        'function': 'get_counts',
        'args': {
            'domains': domains
        }
    };
    var payload = JSON.stringify(request);

    $.when(socketDeferred).then(
        function() {
            // Resolve handler, we're connected
            console.log('Requesting counts: ' + payload);
            socket.send(payload);
        },
        function(status) {
            // Reject handler
            console.log('Socket failed: ', status);
        }
    );
}

console.log('Testing backend server...');
sendCountsRequest(['google.com', 'github.com']);
