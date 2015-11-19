'use strict';
/* global ACTION_ALLOW, ACTION_DENY, ACTION_SCRUB, ACTION_UNKNOWN */

chrome.extension.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.method === 'request_queued_requests') {
        // FIXME: Get this information from the tabs
        sendResponse({
            results: {
                'adds.com': {
                    'actions': {
                        'block': 345, 'allow': 500, 'scrub': 357
                    },
                    // Store like extra PII content here?
                    'extras': ['http://www.adds.com?user=cse509&location=USA',
                               'email=cse509@cs.stonybrook.edu']
                },
                'scottharvey.com': {
                    'actions': {
                        'block': 0, 'allow': 5000, 'scrub': 0
                    },
                    'extras': []
                },
                'stackoverflow.com': {
                    'actions': {
                        'block': 0, 'allow': 352, 'scrub': 5
                    },
                    'extras': ['username=cse509']
                }
            }
        });
    } else if (message.method === 'option_selected') {
        console.log('User decided to ' + message.option + ' for ' +
                    message.hostname);
    }
});

chrome.runtime.onInstalled.addListener(function(details) {
    console.log('previousVersion', details.previousVersion);
});

/**
 * StopLeak namespace.
 * @namespace
 */
var stopleak = stopleak || {};

// Maps request ID's to request to relate requests from different events.
stopleak.requests = {};

// Filter out request from the main frame (the
stopleak.requestFilter = {
    urls: ['<all_urls>']
};

/**
 * Checks whether this string contains any PII data.
 *
 * @param {string} str The string to screen for PII.
 * @returns {boolean} True if the string contains PII data.
 */
function containsPIIdata(str) {
    for (var i = 0; i < stopleak.PIIData.length; ++i) {
        if (str.indexOf(stopleak.PIIData[i]) !== -1) {
            return true;
        }
    }
    return false;
}

/**
 * Checks whether this request body contains any PII data.
 *
 * @param {object} request The request to check.
 * @returns {boolean} True if the body contains PII data.
 */
function piiInRequestBody(request) {
    var piiFound = false;
    var requestBody = stopleak.getRequestBody(request);
    var keys = Object.keys(requestBody);
    for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];
        piiFound = (containsPIIdata(key) || containsPIIdata(requestBody[key]));
        if (piiFound) {
            break;
        }
    }
    return piiFound;
}

/**
 * Checks whether this request's HTTP headers contain any PII data.
 *
 * @param {object} request The request to check.
 * @returns {boolean} True if the headers contain PII data.
 */
function piiInRequestHeaders(request) {
    var piiFound = false;
    var requestHeaders = request.requestHeaders;
    for (var i = requestHeaders.length - 1; i >= 0; --i) {
        var header = requestHeaders[i];
        var headerValue = stopleak.getHeaderValue(header);
        if (header.name === 'Cookie') {
            // TODO: Is there PII in the Cookie being sent?
            // Does this part even matter? I think we should block cookies
            // that are being sent over http.
        } else if (header.name === 'Referer') {
            // TODO: Is there PII in the referrer url, i.e. the current url of
            // this frame.
            // For now just truncate referrer to it's origin to remove params.
            header.value = stopleak.extractOrigin(header.value);
        } else {
            // TODO: just naively check for PII?
            // JavaScript can add arbitrary headers to XMLHttpRequests using
            // the setRequestHeader() method.
            // w3.org/TR/XMLHttpRequest/#the-setrequestheader-method
            piiFound = (containsPIIdata(header.name) ||
                containsPIIdata(headerValue));
        }
        if (piiFound) {
            break;
        }
    }
    return piiFound;
}

/**
 * Checks whether this request contains any PII data.
 *
 * @param {object} request The request to check.
 * @returns {boolean} True if the headers contain PII data.
 */
function piiInRequest(request) {
    return piiInRequestBody(request) || piiInRequestHeaders(request);
}

/**
 * Returns the full request details (onBeforeRequest and onBeforeSendHeaders).
 *
 * @param {object} request
 * @returns {object} Union of requests from onBeforeRequest and
 *     onBeforeSendHeaders
 */
function fullRequest(request) {
    var beforeRequest = stopleak.requests[request.requestId];
    delete stopleak.requests[request.requestId];
    beforeRequest.requestHeaders = request.requestHeaders;
    return beforeRequest;
}

/**
 * Save the request details for onBeforeSendHeaders to use later on.
 *
 * @param {!Object} details The HTTP request before being sent.
 * @return {object} The BlockingResponse to allow or deny this request.
 */
function onBeforeRequest(details) {
    stopleak.requests[details.requestId] = details;
    return {cancel: false};
}

/**
 * Modifies or blocks HTTP requests based possible PII content and the user's
 * preferences.
 *
 * @param {!Object} details The HTTP request containing request headers.
 * @param {string} sourceOrigin The source origin.
 * @param {string} destOrigin The destination origin.
 * @return {object} The BlockingResponse to cancel this request or modify
 *     request headers.
 */
function onBeforeSendHeaders(details, sourceOrigin, destOrigin) {
    var request = fullRequest(details);
    var userAction = stopleak.getReqAction(sourceOrigin, destOrigin);
    var allow = {requestHeaders: request.requestHeaders};

    // Check if allow, deny, scrub, unknown using the full request
    switch (userAction) {
        case ACTION_ALLOW:
            return allow;
        case ACTION_SCRUB:
            // TODO: We can only cancel the request OR modify the HTTP headers
            // We can't modify the body of a request, e.g. formData, therefore
            // if there is PII in the requestBody I think we should cancel.
            var scrubbedHeaders = request.requestHeaders;
            var piiDataInBody = piiInRequest(request);
            return {
                cancel: piiDataInBody,
                requestHeaders: scrubbedHeaders
            };
        case ACTION_DENY:
            // TODO: Should we block unconditionally or only if PII is present?
            stopleak.tabCache.incBlockCount(request.tabId);
            return {cancel: true};
        case ACTION_UNKNOWN:
            if (piiInRequest(request)) {
                // Block and notify user (tab).
                stopleak.tabCache.incBlockCount(request.tabId);
                return {cancel: true};
            } else {
                // Allow request that have no PII data.
                return allow;
            }
            break;
        default:
            console.assert(false, 'Reached unreachable code!');
    }
    return {
        cancel: false,
        requestHeaders: request.requestHeaders
    };
}

/**
 * Pass cross origin requests to the filter callback.
 *
 * @param {function} onBeforeCallback Either onBeforeSendHeaders or
 *    onBeforeRequest.
 * @return {object} The BlockingResponse to allow or deny this request.
 */
function filterCrossTabOrigin(onBeforeCallback) {
    return function(details) {
        var allow = {cancel: false};
        // Allow requests without tabs or for top-level documents.
        if (details.tabId === chrome.tabs.TAB_ID_NONE ||
            details.type === 'main_frame') {
            return allow;
        }
        var destOrigin = stopleak.extractOrigin(details.url);
        var sourceOrigin = stopleak.tabCache.getTabOrigin(details.tabId);
        // Allow requests going to the same origin.
        if (sourceOrigin === destOrigin) {
            return allow;
        } else {
            return onBeforeCallback(details, sourceOrigin, destOrigin);
        }
    };
}

// Hook network requests

// Fires when a request is about to occur. This event is sent before any TCP
// connection is made and can be used to cancel or redirect requests.
chrome.webRequest.onBeforeRequest.addListener(
    filterCrossTabOrigin(onBeforeRequest),
    stopleak.requestFilter,
    ['blocking', 'requestBody']);

// Fires when a request is about to occur and the initial headers have been
// prepared. The event is intended to allow extensions to add, modify, and
// delete request headers (Some headers are not provided). This event can be
// used to cancel the request.
chrome.webRequest.onBeforeSendHeaders.addListener(
    filterCrossTabOrigin(onBeforeSendHeaders),
    stopleak.requestFilter,
    ['blocking', 'requestHeaders']);
