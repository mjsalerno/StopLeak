/*global $, chrome, document*/

var ALEXA_URL = 'https://data.alexa.com/data?cli=10&url=';
var WOT_URL = 'http://api.mywot.com/0.4/public_link_json2?hosts=';
var WOT_KEY = '1d95d1752c1fb408f2bfcdada2fae12f8185ec64';
var DB_HOST = '127.0.0.1';
var DB_PORT = '8765';

/* Create the websocket and define the responses for handling messages received. */
var wsConnection = new WebSocket('ws://' + DB_HOST + ':' + DB_PORT);
wsConnection.onmessage = function(event) {
    // console.log(event);
    var message = JSON.parse(event.data);
    // console.log('Message:'  + message);
    switch(message.type) {
        case 'get_counts':
            var results = message.value;
            var percentBlock = 0, percentScrub = 0, percentAllow = 0;
            var total = results.block + results.scrub + results.allow;
            if (total !== 0) {
                percentBlock = parseInt(results.block / total * 100);
                percentScrub = parseInt(results.scrub / total * 100);
                percentAllow = parseInt(results.allow / total * 100);
            }

            $('#block-button').html('Block ' + results.block +' (' + percentBlock + '%)');
            $('#scrub-button').html('Scrub ' + results.scrub +' (' + percentScrub + '%)');
            $('#allow-button').html('Allow ' + results.allow +' (' + percentAllow + '%)');
            break;
        default:
            console.log('Unsupported event: ' + message.type + ' received.');
            break;
    }
};

function getWOTString(rank) {
    'use strict';
    var rtn;

    if (rank >= 80) {
        rtn = 'Excellent';
    } else if (rank >= 60) {
        rtn = 'Good';
    } else if (rank >= 40) {
        rtn = 'Unsatisfactory';
    } else if (rank >= 20) {
        rtn = 'Poor';
    } else {
        rtn = 'Very poor';
    }

    return rtn;
}

function getAlexaRank(url, element) {
    'use strict';
    $.ajax({
        url: ALEXA_URL + url,
        dataType: 'xml',
        success: function (data) {
            var $xml = $(data);
            // $('#debugging').text('Loaded Alexa');
            element.html('Alexa: ' + $xml.find('SD').find('POPULARITY').attr('TEXT'));
        },
        error: function () {
            // $('#debugging').text('ERROR');
            // $('#alexa-result').html('I BROKE!!!!');
        }
    });
}

function getWOTRank(url, element) {
    'use strict';
    $.ajax({
        type: 'GET',
        url: WOT_URL + url + '/&key=' + WOT_KEY,
        dataType: 'json',
        success: function (data) {
            //put data back up in that function later
            //var $xml = $(data);
            // $('#debugging').text('Loaded WOT');
            //$('#wot-result').html('SHITTY!!');
            // FIXME: Need to handle bad response from WOT
            var rank = data[url][0][0];
            element.html(' WOT: ' + getWOTString(rank));
            // $('#wot-result').html(getWOTString(rank));
        },
        error: function () {
            // $('#debugging').text('ERROR');
            // $('#wot-result').html('I BROKE!!!!');
        }
    });
}

/*
function getActionCount(payload) {
    'use strict';
    //var socket = io('ws://130.245.72.86:8765');
    //socket.emit('chat message', 'does it work');
    wsConnection.onopen = function() {
        // FIXME: This tabs URL should be replaced with the leaky url
        // FIXME: That the site is trying to leak to.
        chrome.tabs.getSelected(null, function(tab) {
            // Extract the domain, preserving any subdomains
            // FIXME: subdomains should be treated the same as their main domains
            var result = tab.url.match(/(?:https?:\/\/)?(?:www\.)?(.*?)\//);
            var domain = result[result.length - 1];
            // Build the payload
            payload = {
                'function': 'get_counts',
                'args': {
                    'domain': domain
                }
            };
            wsConnection.send(JSON.stringify(payload));
        });
    };
}
*/

function fade(e) {
    var element = $(e.target);
    element.parent().parent().fadeOut(400, function() {
        // Remove the item from the actual page.
    });
}

function showExtras(e) {
    var element = $(e.target);
    if (element.parent().parent().find('.extra').length) {
        var extra = element.parent().parent().find('.extra');
        var arrow = element.find('.fa');
        if(extra.css('display') === 'none') {
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

document.addEventListener('DOMContentLoaded', function() {
    'use strict';
    chrome.extension.sendMessage({method: 'request_queued_requests'}, function(response) {
        // This is where the stuff you want from the background page will be
        // console.log(response);
        if('results' in response) {
            // Begin iterating over the returned results
            var results = response.results;
            for(var result in results) {
                // Extract actions
                var hostname = result;
                var actions = null;
                if('actions' in results[result]) {
                    actions = results[result].actions;
                } else {
                    console.log('Malformed response skipping.');
                    continue;
                }
                // Build up the blocked request
                console.log('Hostname: ' + hostname);
                console.log('Actions: ' + actions);
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
                // Build the block, accept, and scrub buttons
                var accept = $('<span>');
                var acceptIcon = $('<i>');
                acceptIcon.addClass('fa');
                acceptIcon.addClass('fa-check');

                accept.addClass('option');
                accept.addClass('allow');
                accept.html(' ');
                accept.append(acceptIcon);
                accept.prop('title', 'accept');

                var block = $('<span>');
                var blockIcon = $('<i>');
                blockIcon.addClass('fa');
                blockIcon.addClass('fa-times');

                block.addClass('option');
                block.addClass('block');
                block.html(' ');
                block.append(blockIcon);
                block.prop('title', 'block');

                var scrub = $('<span>');
                var scrubIcon = $('<i>');
                scrubIcon.addClass('fa');
                scrubIcon.addClass('fa-hand-paper-o');

                scrub.addClass('option');
                scrub.addClass('scrub');
                scrub.html(' ');
                scrub.append(scrubIcon);
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
                alexa.html('Alexa: <img src="images/ajax-loader.gif" alt="fetching alexa results" title="fetching alexa results" />');
                wot.html(' WOT: <img src="images/ajax-loader.gif" alt="fetching wot results" title="fetching wot results" />');

                ranks.append(alexa);
                ranks.append(wot);
                // Populate extra content
                if('extras' in results[result]) {
                    var exList = results[result].extras;
                    if(exList.length > 0) {
                        var arrow = $('<i>');
                        arrow.addClass('fa');
                        arrow.addClass('fa-angle-right');
                        host.append(arrow);
                        host.prop('title', 'Click for a more detailed analysis');
                        for(var extra in exList) {
                            extras.append(exList[extra]);
                            extras.append('<br />');
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
        }
    });
});

/* Demo Code - Needs to be generated dynamically for each item */
/*
$(document).on('click', '.item .hostname', function() {
    var extra = $('.item .extra');
    var arrow = $('.item .hostname .fa');
    if(extra.css('display') === 'none') {
        extra.slideDown('slow');
        extra.css('visibility', 'visible');
        arrow.removeClass('fa-angle-right');
        arrow.addClass('fa-angle-down');
    } else {
        extra.slideUp('slow');
        arrow.removeClass('fa-angle-down');
        arrow.addClass('fa-angle-right');
    }
});

$(document).on('click', '.option', function() {
    var content = $('#content');
    content.fadeOut(400, function() {
        // Remove the item from the actual page.
    });
});
*/

/* Start everything */
// getWOTRank('adds.com', $('.wot'));
// getAlexaRank('adds.com', $('.alexa'));
