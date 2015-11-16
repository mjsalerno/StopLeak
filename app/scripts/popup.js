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

function getAlexaRank(url) {
    'use strict';
    $.ajax({
        url: ALEXA_URL + url,
        dataType: 'xml',
        success: function (data) {
            var $xml = $(data);
            $('#debugging').text('Loaded Alexa');
            $('#alexa-result').html($xml.find('SD').find('POPULARITY').attr('TEXT'));
        },
        error: function () {
            $('#debugging').text('ERROR');
            $('#alexa-result').html('I BROKE!!!!');
        }
    });
}

function getWOTRank(url) {
    'use strict';
    $.ajax({
        type: 'GET',
        url: WOT_URL + url + '/&key=' + WOT_KEY,
        dataType: 'json',
        success: function (data) {
            //put data back up in that function later
            //var $xml = $(data);
            $('#debugging').text('Loaded WOT');
            //$('#wot-result').html('SHITTY!!');
            var rank = data[url][0][0];
            $('#wot-result').html(getWOTString(rank));
        },
        error: function () {
            $('#debugging').text('ERROR');
            $('#wot-result').html('I BROKE!!!!');
        }
    });
}

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

document.addEventListener('DOMContentLoaded', function () {
    'use strict';
    getAlexaRank('google.com');
    getWOTRank('google.com');
    getActionCount();

    chrome.extension.sendMessage({text:'getStuff'},function(reponse) {
        //This is where the stuff you want from the background page will be
        if(reponse.stuff === 'test') {
            // alert('Test received');
        }
    });
});
