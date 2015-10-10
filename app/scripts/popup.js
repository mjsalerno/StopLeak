// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
/*global $, chrome, XMLHttpRequest, document*/

var ALEXA_URL = 'https://data.alexa.com/data?cli=10&url=';
var WOT_URL = 'http://api.mywot.com/0.4/public_link_json2?hosts=';
var WOT_KEY = '1d95d1752c1fb408f2bfcdada2fae12f8185ec64';

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

/**
 * Get the current URL.
 *
 * @param {function(string)} callback - called when the URL of the current tab
 *   is found.
 */
function getCurrentTabUrl(callback) {
    'use strict';
    // Query filter to be passed to chrome.tabs.query - see
    // https://developer.chrome.com/extensions/tabs#method-query
    var queryInfo = {
        active: true,
        currentWindow: true
    };

    chrome.tabs.query(queryInfo, function (tabs) {
        // chrome.tabs.query invokes the callback with a list of tabs that match the
        // query. When the popup is opened, there is certainly a window and at least
        // one tab, so we can safely assume that |tabs| is a non-empty array.
        // A window can only have one active tab at a time, so the array consists of
        // exactly one tab.
        var tab = tabs[0], url = tab.url;

        // A tab is a plain object that provides information about the tab.
        // See https://developer.chrome.com/extensions/tabs#type-Tab

        // tab.url is only available if the "activeTab" permission is declared.
        // If you want to see the URL of other tabs (e.g. after removing active:true
        // from |queryInfo|), then the "tabs" permission is required to see their
        // "url" properties.
        console.assert(typeof url === 'string', 'tab.url should be a string');

        callback(url);
    });

  // Most methods of the Chrome extension APIs are asynchronous. This means that
  // you CANNOT do something like this:
  //
  // var url;
  // chrome.tabs.query(queryInfo, function(tabs) {
  //   url = tabs[0].url;
  // });
  // alert(url); // Shows "undefined", because chrome.tabs.query is async.
}

/**
 * @param {string} searchTerm - Search term for Google Image search.
 * @param {function(string,number,number)} callback - Called when an image has
 *   been found. The callback gets the URL, width and height of the image.
 * @param {function(string)} errorCallback - Called when the image is not found.
 *   The callback gets a string that describes the failure reason.
 */
function getImageUrl(searchTerm, callback, errorCallback) {
    'use strict';
    // Google image search - 100 searches per day.
    // https://developers.google.com/image-search/
    var searchUrl = 'https://ajax.googleapis.com/ajax/services/search/images' +
        '?v=1.0&q=' + encodeURIComponent(searchTerm), x = new XMLHttpRequest();
    x.open('GET', searchUrl);
    // The Google image search API responds with JSON, so let Chrome parse it.
    x.responseType = 'json';
    x.onload = function () {
    // Parse and process the response from Google Image Search.
        var response = x.response, firstResult = response.responseData.results[0];
        if (!response || !response.responseData || !response.responseData.results ||
                response.responseData.results.length === 0) {
            errorCallback('No response from Google Image search!');
            return;
        }
        // Take the thumbnail instead of the full image to get an approximately
        // consistent image size.
        var imageUrl = firstResult.tbUrl;
        var width = parseInt(firstResult.tbWidth);
        var height = parseInt(firstResult.tbHeight);
        console.assert(
            typeof imageUrl === 'string' && !isNaN(width) && !isNaN(height),
            'Unexpected respose from the Google Image Search API!');
        callback(imageUrl, width, height);
    };
    x.onerror = function() {
        errorCallback('Network error.');
    };
    x.send();
}

function renderStatus(statusText) {
    'use strict';
    $('#status').textContent = statusText;
}

document.addEventListener('DOMContentLoaded', function () {
    'use strict';
    getAlexaRank('google.com');
    getWOTRank('google.com');
    getCurrentTabUrl(function(url) {
        // Put the image URL in Google search.
        renderStatus('Performing Google Image search for ' + url);

        getImageUrl(url, function(imageUrl, width, height) {

            renderStatus('Search term: ' + url + '\n' +
                'Google image search result: ' + imageUrl);
            var imageResult = document.getElementById('image-result');
            // Explicitly set the width/height to minimize the number of reflows. For
            // a single image, this does not matter, but if you're going to embed
            // multiple external images in your page, then the absence of width/height
            // attributes causes the popup to resize multiple times.
            imageResult.width = width;
            imageResult.height = height;
            imageResult.src = imageUrl;
            imageResult.hidden = false;

        }, function (errorMessage) {
            renderStatus('Cannot display image. ' + errorMessage);
        });
    });
});
