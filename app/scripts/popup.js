'use strict';
/*global $, chrome, document, updateSyncSetting, ALLOW, DENY, SCRUB, ACTION_UNKNOWN*/

var ALEXA_URL = 'https://data.alexa.com/data?cli=10&url=';
var WOT_URL = 'http://api.mywot.com/0.4/public_link_json2?hosts=';
var WOT_KEY = '1d95d1752c1fb408f2bfcdada2fae12f8185ec64';
var DB_HOST = '127.0.0.1';
var DB_PORT = '8765';

/* The websocket for popup to server communication. */
var socket = null;
/* Deferred Object to send only when open. */
var socketDeferred = $.Deferred();

/**
 * Setup the WebSocket connection to the server.
 *
 * @param {Deferred} socketDeferred Deferred Object used to send only when open.
 * @param {function} onmessage function(event), the onmessage callback.
 * @returns {WebSocket}
 */
function setupWebSocket(socketDeferred, onmessage) {
    var socket = new WebSocket('ws://' + DB_HOST + ':' + DB_PORT);

    socket.onopen = function() {
        socketDeferred.resolve();
    };
    socket.onerror = function(status) {
        socketDeferred.reject(status);
    };
    socket.onclose = function(status) {
        socketDeferred.reject(status);
    };
    socket.onmessage = onmessage;
    return socket;
}

/**
 * Sends a request to the server.
 *
 * @param {object} request A request object to Stringify then send.
 */
function webSocketSend(request) {
    var payload = JSON.stringify(request);
    $.when(socketDeferred).then(
        function() {
            // Resolve handler, we're connected
            console.log('[WebSocket] request: ' + payload);
            socket.send(payload);
        },
        function(event) {
            // Reject handler
            console.log('[WebSocket] failed: ', event);
        }
    );
}

/**
 * Send an async request to the server for the action counts for a list
 * of domains.
 *
 * @param {object} domains List of domain name strings.
 */
function sendCountsRequest(domains) {
    // Build the payload
    var request = {
        'function': 'get_counts',
        'args': {
            'domains': domains
        }
    };
    webSocketSend(request);
}

/**
 * Send an async request to the server for the action counts for a list
 * of domains.
 *
 * @param {object} origin The origin string.
 * @param {object} choice allow, block, or scrub
 */
function sendTallyRequest(origin, choice) {
    // Build the payload
    var request = {
        'function': 'tally',
        'args': {
            'domains': origin,
            'choice': choice
        }
    };
    webSocketSend(request);
}

function getWOTString(rank) {
    var rtn;

    if (rank >= 80) {
        rtn = ['Excellent', 'images/30_excellent.png'];
    } else if (rank >= 60) {
        rtn = ['Good', 'images/30_good.png'];
    } else if (rank >= 40) {
        rtn = ['Unsatisfactory', 'images/30_unsatisfactory.png'];
    } else if (rank >= 20) {
        rtn = ['Poor', 'images/30_poor.png'];
    } else {
        rtn = ['Very poor', 'images/30_verypoor.png'];
    }

    return rtn;
}

function getAlexaRank(url, element) {
    $.ajax({
        url: ALEXA_URL + url,
        dataType: 'xml',
        success: function(data) {
            var $xml = $(data);
            // $('#debugging').text('Loaded Alexa');
            var ranking = $xml.find('SD').find('POPULARITY').attr('TEXT');
            if (ranking === undefined) {
                element.html('Alexa: Not ranked');
            } else {
                element.html('Alexa: ' + ranking);
            }
        },
        error: function() {
            // TODO: Special case for handling bad request?
        }
    });
}

function getWOTRank(url, element) {
    $.ajax({
        type: 'GET',
        url: WOT_URL + url + '/&key=' + WOT_KEY,
        dataType: 'json',
        success: function(data) {
            //put data back up in that function later
            if (data[url][0] === undefined) {
                element.html(' WOT: None');
            } else {
                var rank = data[url][0][0];
                var wot = getWOTString(rank);
                element.html(' WOT: ' + wot[0]);
                var icon = $('<img>', {
                    src: wot[1],
                    alt: wot[0]
                });
                element.append(icon);
            }
        },
        error: function() {
            // TODO: Special case for handling bad request?
        }
    });
}

function optionToStorage(option) {
    switch (option) {
        case 'allow':
            return ALLOW;
        case 'scrub':
            return SCRUB;
        case 'block':
            return DENY;
        default:
            return ACTION_UNKNOWN;
    }
}

function fade(e) {
    var element = $(e.target);
    var parent = element.parent().parent().parent();
    // Get the type of option selected
    var option = element.parent().attr('title');
    var hostname = parent.find('.hostname').data('hostname');
    // Inform background of our decesion
    updateSyncSetting(optionToStorage(option), {val: hostname}, function() {
        parent.fadeOut(400, function() {
            // Remove the item from the actual page.
            parent.parent().remove(parent);
        });
    }, null);
}

function showExtras(e) {
    var element = $(e.target);
    if (element.parent().parent().find('.extra').length) {
        var extra = element.parent().parent().find('.extra');
        var arrow = element.find('.fa');
        if (extra.css('display') === 'none') {
            extra.slideDown('slow');
            extra.css('visibility', 'visible');
            arrow.removeClass('fa-angle-right');
            arrow.addClass('fa-angle-down');
        } else {
            extra.slideUp('slow');
            arrow.removeClass('fa-angle-down');
            arrow.addClass('fa-angle-right');
        }
    } else {
        console.log('No extra element');
    }
}

function calculateStats(actions) {
    var total = actions.block + actions.scrub + actions.allow;
    var blockPercent = 0;
    var scrubPercent = 0;
    var allowPercent = 0;
    // Compute statistics
    if (total !== 0) {
        blockPercent = ((actions.block / total) * 100).toFixed(1);
        scrubPercent = ((actions.scrub / total) * 100).toFixed(1);
        allowPercent = ((actions.allow / total) * 100).toFixed(1);
    }

    return {
        block: [actions.block, blockPercent],
        scrub: [actions.scrub, scrubPercent],
        allow: [actions.allow, allowPercent]
    };
}

function updateCountCaption(item, className, percent) {
    var caption = item.find('.' + className);
    caption.html(percent + '%');
}

function addCountsToUI(counts) {
    for (var hostname in counts) {
        if (!counts.hasOwnProperty(hostname)) {
            continue;
        }
        var actions = calculateStats(counts[hostname]);
        // Since the id is a hostname we must replace the dots, since JQuery
        // doesn't like dots.
        // e.g. '#google.com' -> '#google\.com'
        var itemId = hostname.replace(/\./g, '\\.');
        var item = $('#' + itemId);
        updateCountCaption(item, 'allow', actions.allow[1]);
        updateCountCaption(item, 'block', actions.block[1]);
        updateCountCaption(item, 'scrub', actions.scrub[1]);
    }
}

/**
 * Parses messages received off of the WebSocket to the server.
 *
 * @param {object} event The event received on the WebSocket.
 */
function webSocketReceive(event) {
    var message = JSON.parse(event.data);
    switch (message.type) {
        case 'get_counts':
            var counts = message.value;
            console.log('[WebSocket] Received action counts: ', message);
            addCountsToUI(counts);
            break;
        default:
            console.log('[WebSocket] Unsupported response: ' + message.type);
            break;
    }
}

function updateUI(hostname, request) {
    // Extract actions
    var actions = null;
    console.log();
    if ('actions' in request) {
        actions = calculateStats(request.actions);
    } else {
        console.log('Malformed message skipping.');
        return;
    }
    // Build up the blocked request
    console.log('Hostname: ' + hostname);
    console.log('Actions: ', actions);
    // Create the parent span object
    var item = $('<span>');
    item.addClass('item');
    // Store the hostname as the id for easy lookups
    item.attr('id', hostname);
    var options = $('<div>');
    var ranks = $('<div>');
    var extras = $('<div>');
    extras.addClass('extra');
    var hr = $('<hr/>');

    // Build all the option spans
    var host = $('<span>');
    host.html(hostname + ' ');
    host.addClass('hostname');
    host.data('hostname', hostname);
    // Build the block, accept, and scrub buttons
    var accept = $('<span>');
    var acceptIcon = $('<i>');
    acceptIcon.addClass('fa');
    acceptIcon.addClass('fa-check');
    var acceptCaption = $('<span>');
    acceptCaption.html(actions.allow[1] + '%');

    accept.addClass('option');
    accept.addClass('allow');
    accept.html(' ');
    accept.append(acceptIcon);
    accept.append(acceptCaption);
    accept.prop('title', 'allow');

    var block = $('<span>');
    var blockIcon = $('<i>');
    blockIcon.addClass('fa');
    blockIcon.addClass('fa-times');
    var blockCaption = $('<span>');
    blockCaption.html(actions.block[1] + '%');

    block.addClass('option');
    block.addClass('block');
    block.html(' ');
    block.append(blockIcon);
    block.append(blockCaption);
    block.prop('title', 'block');

    var scrub = $('<span>');
    var scrubIcon = $('<i>');
    scrubIcon.addClass('fa');
    scrubIcon.addClass('fa-hand-paper-o');
    var scrubCaption = $('<span>');
    scrubCaption.html(actions.scrub[1] + '%');

    scrub.addClass('option');
    scrub.addClass('scrub');
    scrub.html(' ');
    scrub.append(scrubIcon);
    scrub.append(scrubCaption);
    scrub.prop('title', 'scrub');
    // Add all the options to the options div
    options.append(host);
    options.append(accept);
    options.append(block);
    options.append(scrub);
    // Build all the rank spans
    var alexa = $('<span>');
    alexa.addClass('alexa');
    var wot = $('<span>');
    wot.addClass('wot');
    // Create loading image elements
    var loader = $('<img>', {
        src: 'images/ajax-loader.gif',
        alt: 'fetching alexa results',
        title: 'fetching alexa results'
    });
    // Add loader image to alexa
    alexa.html('Alexa: ');
    alexa.append(loader);
    // Add loader image to wot
    loader = $('<img>', {
        src: 'images/ajax-loader.gif',
        alt: 'fetching wot results',
        title: 'fetching wot results'
    });
    wot.html(' WOT: ');
    wot.append(loader);
    // Add both rankings to the ranks div
    ranks.append(alexa);
    ranks.append(wot);
    // Populate extra content
    if ('extras' in request) {
        var exList = request.extras;
        if (exList.length > 0) {
            var arrow = $('<i>');
            arrow.addClass('fa');
            arrow.addClass('fa-angle-right');
            host.append(arrow);
            host.prop('title',
                      'Click for a more detailed analysis');
            // extras.append('<br />');
            // Add basic url information
            extras.append('<h3>Info</h3>');
            for (var extra in exList) {
                extras.append(exList[extra]);
                extras.append('<br />');
            }
            // Add the headers
            extras.append('<h3>Headers</h3>');
            var headers = request.headers;
            for (var header in headers) {
                extras.append('<b>' + headers[header].name + '</b>: ' +
                              headers[header].value + '<br />');
            }
            // Add the extras click handler
            host.click(showExtras);
        } else {
            host.prop('title', 'Leaky url');
        }
    } else {
        console.log('NO Extras!');
    }
    // Add default catchall for clicking an action
    // FIXME: Make these buttons communicate with python server
    // FIXME: or the background js page?
    accept.click(fade);
    block.click(fade);
    scrub.click(fade);

    // Put together the whole object
    item.append(options);
    item.append(ranks);
    item.append(extras);
    item.append(hr);
    // Add the item to the parent container
    $('#content').append(item);

    // Kick off async tasks to get rankings
    getWOTRank(hostname, wot);
    getAlexaRank(hostname, alexa);
}

/**
 * Updates the UI for each request. Also collects the 3rd party hostnames and
 * sends the actions counts query to the server.
 *
 * @param {object} requests Usable by updateUI()
 */
function processRequests(requests) {
    var hostnames = [];
    for (var hostname in requests) {
        if (!requests.hasOwnProperty(hostname)) {
            continue;
        }
        hostnames.push(hostname);
        updateUI(hostname, requests[hostname]);
    }
    sendCountsRequest(hostnames);
}

/**
 * Convert background requests Object into the format expected by the UI.
 *
 * @param {object} requests
 * @returns {object} requests usable by updateUI()
 */
function convertRequests(requests) {
    var blockedRequests = {};
    for (var id in requests) {
        if (!requests.hasOwnProperty(id)) {
            continue;
        }
        var request = requests[id];
        // Extract the hostname
        var url = new URL(request.url);
        var hostname = url.hostname;
        // Get the reason
        var reasons = [];
        for (var i in request.blockReasons) {
            reasons.push(request.blockReasons[i]);
        }
        var extraCanidates = [url.origin, url.protocol, url.username,
                              url.password, url.search];
        var canidateKeys = ['<b>Origin:</b>', '<b>Protocol:</b>',
                            '<b>Username:</b>', '<b>Password:</b>',
                            '<b>Query Params:</b>'];
        var extras = [];
        for (var j in extraCanidates) {
            if (extraCanidates[j].length > 0) {
                extras.push(canidateKeys[j] + ' ' + extraCanidates[j]);
            }
        }

        console.log(requests[id]);
        // Add the details about the request
        blockedRequests[hostname] = {
            requestId: id,
            reasons: reasons,
            headers: request.requestHeaders,
            extras: extras,
            actions: {
                block: 0, allow: 0, scrub: 0
            }
        };
        console.log(blockedRequests);
    }
    return blockedRequests;
}

// Initialize everything.

socket = setupWebSocket(socketDeferred, webSocketReceive);

$(document).ready(function() {
    // Retrieve the current tabId to ask for all our blocked requests.
    var query = {active: true, currentWindow: true};
    chrome.tabs.query(query, function(tabs) {
        var currentTab = tabs[0];
        // Now just grab the requests from the background page
        chrome.runtime.getBackgroundPage(function(backgroundPage) {
            var requests = backgroundPage.getBlockedRequests(currentTab.id);
            var blockedRequests = convertRequests(requests);
            // Display the requests in the UI
            processRequests(blockedRequests);
        });
    });
});

/* Add the options page js to the button */
$('.header .settings').click(function() {
    chrome.runtime.openOptionsPage();
});
