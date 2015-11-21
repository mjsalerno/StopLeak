'use strict';
/*global $, chrome, document*/

var ALEXA_URL = 'https://data.alexa.com/data?cli=10&url=';
var WOT_URL = 'http://api.mywot.com/0.4/public_link_json2?hosts=';
var WOT_KEY = '1d95d1752c1fb408f2bfcdada2fae12f8185ec64';

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

function fade(e) {
    var element = $(e.target);
    var parent = element.parent().parent().parent();
    parent.fadeOut(400, function() {
        // Remove the item from the actual page.
        parent.parent().remove(parent);
    });
    // Get the type of option selected
    var option = element.parent().attr('title');
    var hostname = parent.find('.hostname').data('hostname');
    // Inform background of our decesion
    chrome.extension.sendMessage({method: 'option_selected',
                                  option: option,
                                  hostname: hostname});
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

function updateUI(request, requests) {
    // Extract actions
    var hostname = request;
    var actions = null;
    console.log();
    if ('actions' in requests[request]) {
        actions = calculateStats(requests[request].actions);
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
    if ('extras' in requests[request]) {
        var exList = requests[request].extras;
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
            var headers = requests[request].headers;
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

function processRequests(requests) {
    for (var request in requests) {
        if (!requests.hasOwnProperty(request)) {
            continue;
        }
        updateUI(request, requests);
    }
}

$(document).ready(function() {
    // Retrieve the current tabId to ask for all our blocked requests.
    var query = {active: true, currentWindow: true};
    chrome.tabs.query(query, function(tabs) {
        var currentTab = tabs[0];
        // Now just grab the requests from the background page
        chrome.runtime.getBackgroundPage(function(backgroundPage) {
            var requests = backgroundPage.getBlockedRequests(currentTab.id);
            var blockedRequests = {};

            for (var id in requests) {
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
            // Display the requests in the UI
            processRequests(blockedRequests);
        });
    });
});

/* Add the options page js to the button */
$('.header .settings').click(function() {
    chrome.runtime.openOptionsPage();
});
