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

function getWOTRank(origin, element) {
    var hostname = new URL(origin).hostname;
    $.ajax({
        type: 'GET',
        url: WOT_URL + hostname + '/&key=' + WOT_KEY,
        dataType: 'json',
        success: function(data) {
            //put data back up in that function later
            if (!(hostname in data) || data[hostname][0] === undefined) {
                element.html(' WOT: None');
            } else {
                var rank = data[hostname][0][0];
                var wot = getWOTString(rank);
                element.html(' WOT: ' + wot[0]);
                var icon = $('<img>', {
                    class: 'wot-image',
                    src: wot[1],
                    alt: wot[0],
                    title: 'WOT score: ' + rank
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
    var origin = parent.find('.hostname').data('origin');
    // Inform background of our decesion
    console.log('option: ' + option);
    console.log('hostname: ' + origin);
    chrome.extension.sendMessage({method: 'option_selected',
                                  option: option,
                                  hostname: origin});

    updateSyncSetting(optionToStorage(option), {val: origin}, function() {
        parent.fadeOut(400, function() {
            // Remove the item from the actual page.
            parent.parent().remove(parent);
        });
    }, null);
}

function showRequests(e) {
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

function showSubRequest() {
    var element = $(this);
    console.log(element);
    if (element.find('.request').length) {
        var rbody = element.find('.request');
        var arrow = element.find('.fa');
        if (rbody.css('display') === 'none') {
            rbody.slideDown('slow');
            rbody.css('visibility', 'visible');
            arrow.removeClass('fa-angle-right');
            arrow.addClass('fa-angle-down');
        } else {
            rbody.slideUp('slow');
            arrow.removeClass('fa-angle-down');
            arrow.addClass('fa-angle-right');
        }
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
    for (var origin in counts) {
        if (!counts.hasOwnProperty(origin)) {
            continue;
        }
        var actions = calculateStats(counts[origin]);
        // Since the id is a origin we must replace the dots, since JQuery
        // doesn't like dots.
        // e.g. '#https://google.com' -> '#https://google\.com'
        var itemId = origin.replace(/\./g, '\\.');
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

function updateUI(origin, requests) {
    // Extract actions
    // var actions = null;
    // Create the parent span object
    var item = $('<span>', {
        class: 'item',
        id: origin
    });
    // Store the origin as the id for easy lookups
    var options = $('<div>');
    var ranks = $('<div>');
    var extras = $('<div>', {
        class: 'extra'
    });
    var hr = $('<hr/>');
    // Build all the option spans
    var org = $('<span>', {
        class: 'origin',
        title: 'Click for a more detailed analysis'
    });
    org.html(origin + ' ');
    org.data('origin', origin);
    // Add the extras click handler
    org.click(showRequests);
    // Create the drop down arrow
    var arrow = $('<i>', {
        class: 'fa fa-angle-right'
    });
    org.append(arrow);
    // Build the accept button
    var accept = $('<span>', {
        class: 'option allow',
        title: 'allow'
    });
    var acceptIcon = $('<i>', {
        class: 'fa fa-check'
    });
    var acceptCaption = $('<span>');
    // acceptCaption.html(actions.allow[1] + '%');

    accept.html(' ');
    accept.append(acceptIcon);
    accept.append(acceptCaption);

    // Build the block button
    var block = $('<span>', {
        class: 'option block'
    });
    var blockIcon = $('<i>', {
        class: 'fa fa-times',
        title: 'block'
    });
    var blockCaption = $('<span>');
    // blockCaption.html(actions.block[1] + '%');

    block.html(' ');
    block.append(blockIcon);
    block.append(blockCaption);

    // Build the scrub button
    var scrub = $('<span>', {
        class: 'option scrub',
        title: 'scrub'
    });
    var scrubIcon = $('<i>', {
        class: 'fa fa-eraser'
    });
    var scrubCaption = $('<span>');
    // scrubCaption.html(actions.scrub[1] + '%');

    scrub.html(' ');
    scrub.append(scrubIcon);
    scrub.append(scrubCaption);

    // Add all the options to the options div
    options.append(org);
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
    // Build the multiple request data sections
    for (var i in requests) {
        var request = requests[i];
        var rlink = $('<div>', {
            html: '<h3><u>Request ' + (parseInt(i) + 1) +
                  '</u> <i class="fa fa-angle-right"></i></h3>',
            class: 'subrequest'
        });
        var rdiv = $('<div>', {
            css: {
                display: 'none',
                color: 'black'
            },
            class: 'request'
        });
        // Add Reasons for pontential concern
        for (var r in request.reasons) {
            rdiv.append(request.reasons[r]);
        }
        // Add URL info
        rdiv.append('<h4><u>Info:</u></h4>');
        for (var e in request.extras) {
            rdiv.append(request.extras[e]);
            rdiv.append('<br />');
        }
        // Add the header info
        rdiv.append('<h4><u>Headers</u></h4>');
        for (var h in request.headers) {
            var header = request.headers[h];
            rdiv.append('<b>' + header.name + '</b>: ' +
                          header.value + '<br />');
        }
        // Add the Request to the extras div
        rlink.append(rdiv);
        extras.append(rlink);
        // Add the onclick action for rlink
        rlink.click(showSubRequest);
    }

    // FIXME: Make these buttons communicate with python server
    // FIXME: or the background js page?
    acceptIcon.click(fade);
    blockIcon.click(fade);
    scrubIcon.click(fade);

    // Put together the whole object
    item.append(options);
    item.append(ranks);
    item.append(extras);
    item.append(hr);
    // Add the item to the parent container
    $('#content').append(item);

    // Kick off async tasks to get rankings
    getWOTRank(origin, wot);
    getAlexaRank(origin, alexa);
}

/**
 * Updates the UI for each request. Also collects the 3rd party hostnames and
 * sends the actions counts query to the server.
 *
 * @param {object} requests Usable by updateUI()
 */
function processRequests(requests) {
    var origins = [];
    for (var origin in requests) {
        if (!requests.hasOwnProperty(origin)) {
            continue;
        }
        origins.push(origin);
        console.log(origin);
        // Build the UI
        updateUI(origin, requests[origin]);
    }
    sendCountsRequest(origins);
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
        var origin = url.origin;
        // Get the reason
        var reasons = [];
        for (var i in request.blockReasons) {
            reasons.push(request.blockReasons[i]);
        }
        var extraCanidates = [url.protocol, url.username,
                              url.password, url.port, url.search];
        var canidateKeys = ['<b>Protocol:</b>', '<b>Username:</b>',
                            '<b>Password:</b>', '<b>Port:</b>',
                            '<b>Query Params:</b>'];
        var extras = [];
        for (var j in extraCanidates) {
            if (extraCanidates[j].length > 0) {
                extras.push(canidateKeys[j] + ' ' + extraCanidates[j]);
            }
        }
        // Put the results in the correct format
        var results = {
            rid: id,
            reasons: reasons,
            headers: request.requestHeaders,
            extras: extras
        };
        // Add the details about the request
        if (origin in blockedRequests) {
            blockedRequests[origin].push(results);
        } else {
            blockedRequests[origin] = [results];
        }
    }
    console.log(blockedRequests);
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
