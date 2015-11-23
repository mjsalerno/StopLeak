'use strict';
/*global $, chrome, document, updateSyncSetting, ACTION_ALLOW, ACTION_DENY,
CUSTOM_SETTINGS, ACTION_SCRUB, ACTION_UNKNOWN*/

var ALEXA_URL = 'https://data.alexa.com/data?cli=10&url=';
var WOT_URL = 'https://api.mywot.com/0.4/public_link_json2?hosts=';
var WOT_KEY = '1d95d1752c1fb408f2bfcdada2fae12f8185ec64';
var DB_HOST = 'ip.roofis0.net';
var DB_PORT = '667';

//the current tab so we can get the url for custom settings
var currentTab = {};

/**
 * Sends a request to the server.
 *
 * @param {object} request A request object to Stringify then send.
 * @param {function} onmessage function(event), the onmessage callback.
 */
function webSocketSend(request, onmessage) {
    var payload = JSON.stringify(request);
    var socket = new WebSocket('wss://' + DB_HOST + ':' + DB_PORT);

    socket.onopen = function() {
        console.log('[WebSocket] request: ' + payload);
        socket.send(payload);
    };
    socket.onerror = function(status) {
        console.log('[WebSocket] failed: ', status);
    };
    socket.onclose = function() {
        console.log('[WebSocket] closed');
    };
    socket.onmessage = onmessage;
}

/**
 * Send an async request to the server for the action counts for a list
 * of domains.
 *
 * @param {object} domains List of domain name strings.
 * @param {function} onmessage function(event), the onmessage callback.
 */
function sendCountsRequest(domains, onmessage) {
    // Build the payload
    var request = {
        'function': 'get_counts',
        'args': {
            'domains': domains
        }
    };
    webSocketSend(request, onmessage);
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
            'domain': origin,
            'choice': choice
        }
    };
    webSocketSend(request, null);
}

/**
 * Converts an WOT value to a human readable description.
 *
 * @param {int} rank Rank returned by the request to WOT.
 * @return {string} Returns an english description of the WOT value.
 */
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

/**
 * Queries alexa for the origin's rank and adds it to the DOM element passed
 * into the function.
 *
 * @param {string} origin String containing the origin to query alexa for.
 * @param {object} element DOM element to add the alexa rank to.
 */
function getAlexaRank(origin, element) {
    $.ajax({
        url: ALEXA_URL + origin,
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

/**
 * Queries WOT for the ranking of the origins hostname and adds it to the DOM
 * element passed into the function.
 *
 * @param {string} origin String containing the origin to query WOT for.
 * @param {object} element DOM element to add the alexa rank to.
 */
function getWOTRank(origin, element) {
    var hostname = new URL(origin).hostname;
    $.ajax({
        type: 'GET',
        url: WOT_URL + hostname + '/&key=' + WOT_KEY,
        dataType: 'json',
        success: function(data) {
            //put data back up in that function later
            var icon = null;
            if (!(hostname in data) || data[hostname][0] === undefined) {
                element.html(' WOT: None');
                icon = $('<img>', {
                    class: 'wot-image',
                    src: 'images/30_unknown.png',
                    alt: 'unknown ranking',
                    title: 'WOT score: None'
                });
                element.append(icon);
            } else {
                var rank = data[hostname][0][0];
                var wot = getWOTString(rank);
                element.html(' WOT: ' + wot[0]);
                icon = $('<img>', {
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
            return ACTION_ALLOW;
        case 'scrub':
            return ACTION_SCRUB;
        case 'block':
            return ACTION_DENY;
        default:
            return ACTION_UNKNOWN;
    }
}

/**
 * Handles the selection of the allow, scrub, and block options for the
 * blocked request.
 *
 * @param {object} e Event object associated with the DOM event.
 */
function selectOption(e) {
    var element = $(e.target);
    var parent = element.parent().parent().parent();
    // Get the type of option selected
    var option = element.parent().attr('title');
    var origin = parent.find('.origin').data('origin');
    // Reset all colors to grey
    parent.find('.option .fa').css('color', '#B8B8B8');
    // Now set the selected color
    switch (option) {
        case 'allow':
            element.css('color', 'green');
            break;
        case 'block':
            element.css('color', 'red');
            break;
        case 'scrub':
            element.css('color', 'orange');
            break;
        default:
            console.log('Unknown option selected: ' + option);
            break;
    }
    // If successfully sync'd then tell server of our choice
    sendTallyRequest(origin, option);
    var bgPage = chrome.extension.getBackgroundPage();
    bgPage.updateSyncSetting(CUSTOM_SETTINGS,
        {src: currentTab.url, dst: origin, action: optionToStorage(option)},
        null, null);
}

/**
 * Handles making the list subrequests visible and hidden.
 *
 * @param {object} e Event object associated with the DOM event.
 */
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

/**
 * Handles making each individual subrequest visible and hidden.
 */
function showSubRequest() {
    var element = $(this);
    // console.log(element);
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

/**
 * Calculates the block, scrub, and allow stats.
 *
 * @param {object} actions Map containing the action count for each action.
 */
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

/**
 * Adds a percentage value to the given item.
 *
 * @param {object} item DOM element to add the statistic to.
 * @param {string} className Class name to search for.
 * @param {float} percent Value to append to the item.
 */
function updateCountPercent(item, className, percent) {
    // Grab the choice span
    var choiceSpans = item.getElementsByClassName(className);
    // Grab the 2nd span, which is for percents
    var percentSpan = choiceSpans[0].children[1];
    percentSpan.innerHTML = percent + '%';
}

/**
 * Adds all the percentage values to the allow, block, and scrub fields.
 *
 * @param {object} counts Map containing the count values for each option.
 */
function addCountsToUI(counts) {
    for (var origin in counts) {
        if (!counts.hasOwnProperty(origin)) {
            continue;
        }
        var actions = calculateStats(counts[origin]);
        // The origin is the id
        var item = document.getElementById(origin);
        updateCountPercent(item, 'allow', actions.allow[1]);
        updateCountPercent(item, 'block', actions.block[1]);
        updateCountPercent(item, 'scrub', actions.scrub[1]);
        console.log('Updated action counts for: ' + origin, counts[origin]);
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

/**
 * Creates an element in the UI for the origin.
 *
 * @param {string} origin Origin (protocol/hostname:port), used to identify the request.
 * @param {object[]} requests List of requests made for the origin.
 */
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
    var acceptCaption = $('<span>', {
        class: 'option-stats'
    });
    // acceptCaption.html(actions.allow[1] + '%');
    accept.html(' ');
    accept.append(acceptIcon);
    accept.append(acceptCaption);

    // Build the block button
    var block = $('<span>', {
        class: 'option block',
        title: 'block'
    });
    var blockIcon = $('<i>', {
        class: 'fa fa-times',
    });
    var blockCaption = $('<span>', {
        class: 'option-stats'
    });

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
    var scrubCaption = $('<span>', {
        class: 'option-stats'
    });

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
            rdiv.append('<br />');
        }
        // Add URL info
        if (request.extras.length > 0) {
            rdiv.append('<h4><u>Info:</u></h4>');
            for (var e in request.extras) {
                rdiv.append(request.extras[e]);
                rdiv.append('<br />');
            }
        }
        // Add Found leaked pii
        if (request.pii.length > 0) {
            rdiv.append('<h4><u>Detected Leaked PII:</u></h4>');
            for (var p in request.pii) {
                rdiv.append(request.pii[p]);
                rdiv.append('<br />');
            }
        }
        // Add the header info
        if (request.headers.length > 0) {
            rdiv.append('<h4><u>Headers</u></h4>');
            for (var h in request.headers) {
                var header = request.headers[h];
                rdiv.append('<b>' + header.name + '</b>: ' +
                              header.value + '<br />');
            }
        }
        // Add the Request to the extras div
        rlink.append(rdiv);
        extras.append(rlink);
        // Add the onclick action for rlink
        rlink.click(showSubRequest);
        rdiv.click(function(e) {
            e.stopPropagation();
        });
        rdiv.css('cursor', 'default');
    }
    // Add function to communicate with backend
    acceptIcon.click(selectOption);
    blockIcon.click(selectOption);
    scrubIcon.click(selectOption);
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
        // console.log(origin);
        // Build the UI
        updateUI(origin, requests[origin]);
    }
    sendCountsRequest(origins, webSocketReceive);
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
        // Look through URL and request information
        var extraCanidates = [url.protocol, url.username,
                              url.password, url.port, url.search,
                              request.method];
        var canidateKeys = ['<b>Protocol:</b>', '<b>Username:</b>',
                            '<b>Password:</b>', '<b>Port:</b>',
                            '<b>Query Params:</b>', '<b>Method:</b>'];
        var extras = [];
        for (var j in extraCanidates) {
            if (extraCanidates[j].length > 0) {
                extras.push(canidateKeys[j] + ' ' + extraCanidates[j]);
            }
        }
        // Get a list of the pii found in the request
        var pii = [];
        for (var k in request.piiFound) {
            pii.push(request.piiFound[k]);
        }
        // Get a list of all the headers
        var headers = [];
        for (var l in request.requestHeaders) {
            headers.push(request.requestHeaders[l]);
        }
        // Put the results in the correct format
        var results = {
            rid: id,
            reasons: reasons,
            pii: pii,
            headers: headers,
            extras: extras
        };
        // Add the details about the request
        if (origin in blockedRequests) {
            blockedRequests[origin].push(results);
        } else {
            blockedRequests[origin] = [results];
        }
    }
    return blockedRequests;
}

// Initialize everything.
$(document).ready(function() {
    // Retrieve the current tabId to ask for all our blocked requests.
    var query = {active: true, currentWindow: true};
    chrome.tabs.query(query, function(tabs) {
        currentTab = tabs[0];
        // Now just grab the requests from the background page
        chrome.runtime.getBackgroundPage(function(backgroundPage) {
            var requests = backgroundPage.getBlockedRequests(currentTab.id);
            var blockedRequests = convertRequests(requests);
            // Display the requests in the UI
            processRequests(blockedRequests);
        });
    });
    chrome.tabs.getSelected(null, function(tab) {
        var origin = new URL(tab.url).origin;
        var bgPage = chrome.extension.getBackgroundPage();
        var whitelist = bgPage.stopleak.SITE_WIDE_WHITE_LIST;
        var openWhitelist = function() {
            chrome.runtime.openOptionsPage();
        };

        var settingHover = function() {
            $(this).css('cursor', 'pointer');
            $(this).css('text-decoration', 'underline');
        };

        for (var i in whitelist) {
            if (origin === whitelist[i]) {
                var content = $('#content');
                var message1 = 'The current tab is in the whitelist ';
                var message2 = '<br/>Go to the ';
                var message3 = ' page if you wish to remove it.';
                var check = $('<i>', {
                    class: 'fa fa-check',
                    css: {
                        color: 'green'
                    }
                });
                var settings = $('<span>', {
                    html: 'settings',
                    class: 'settings',
                    css: {
                        'color': '#2196f3'
                    }
                });
                // greyscale the image
                $('.logo').css('filter', 'grayscale(100%)');
                $('.logo').css('webkitFilter', 'grayscale(100%)');
                // Add onclick and hover functions
                settings.hover(settingHover);
                settings.click(openWhitelist);
                // Append the content to the page
                content.append(message1);
                content.append(check);
                content.append(message2);
                content.append(settings);
                content.append(message3);
                // Done searching the whitelist
                break;
            }
        }
    });
});

/* Add the options page js to the button */
$('.settings').click(function() {
    chrome.runtime.openOptionsPage();
});
