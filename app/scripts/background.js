'use strict';
/* global ACTION_ALLOW, ACTION_DENY, ACTION_SCRUB, ACTION_UNKNOWN */

chrome.extension.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.text === 'getStuff') {
        sendResponse({stuff: 'test'}); //This would be where you send your stuff
    }
    console.log('Received a message');
});

chrome.runtime.onInstalled.addListener(function (details) {
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
 * Checks whether this request contains any PII data.
 * @param {object} request The request to check.
 * @returns {boolean} True if the request contains PII data.
 */
function containsPIIdata(request) {
    var str = JSON.stringify(request);
    for (var i = 0; i < stopleak.PIIData.length; ++i) {
        if (str.indexOf(stopleak.PIIData[i]) !== -1) {
            return true;
        }
    }
    return false;
}

/**
 * Returns the full request details (onBeforeRequest and onBeforeSendHeaders).
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
 * @param {!Object} details The HTTP request containing request headers.
 * @param {string} sourceDomain The source domain.
 * @param {string} destDomain The destination domain.
 * @return {object} The BlockingResponse to cancel this request or modify
 *     request headers.
 */
function onBeforeSendHeaders(details, sourceDomain, destDomain) {
    var request = fullRequest(details);
    var userAction = stopleak.getReqAction(sourceDomain, destDomain);
    var allow = {requestHeaders: request.requestHeaders};

    // Check if allow, deny, scrub, unknown using the full request
    switch (userAction) {
        case ACTION_ALLOW:
            return allow;
        case ACTION_SCRUB:
            //TODO: We can only cancel the request OR modify the HTTP headers
            // We can't modify the body of a request, e.g. formData, therefore
            // if there is PII in the requestBody I think we should cancel.
            var scrubbedHeaders = request.requestHeaders;
            var piiDataInBody = containsPIIdata(request);
            return {
                cancel: piiDataInBody,
                requestHeaders: scrubbedHeaders
            };
        case ACTION_DENY:
            //TODO: Should we block unconditionally or only if PII is present?
            return {cancel: containsPIIdata(request)};
        case ACTION_UNKNOWN:
            if (containsPIIdata(request)) {
                // Block and notify user (tab).
                return {cancel: true};
            } else {
                // Allow request that have no PII data.
                return allow;
            }
            break;
        default:
            console.assert(false, 'Reached unreachable code!');
    }

    // Delete third party cookies (just an example)
    for (var i = request.requestHeaders.length - 1; i >= 0; --i) {
        if (request.requestHeaders[i].name === 'Cookie') {
            request.requestHeaders.splice(i, 1);
            console.log('Dropped cookie dest:' + destDomain + ', source:' +
                sourceDomain + ' tab:' + request.tabId + ' frame:' +
                request.frameId);
            stopleak.tabCache.incBlockCount(request.tabId);
        }
    }
    return {
        cancel: false,
        requestHeaders: request.requestHeaders
    };
}

/**
 * Pass cross domain requests to the filter callback.
 * @param {function} onBeforeCallback Either onBeforeSendHeaders or
 *    onBeforeRequest.
 * @return {object} The BlockingResponse to allow or deny this request.
 */
function filterCrossDomain(onBeforeCallback) {
    return function (details) {
        var allow = {cancel: false};
        // Allow requests without tabs or for top-level documents.
        if (details.tabId === chrome.tabs.TAB_ID_NONE ||
            details.type === 'main_frame') {
            return allow;
        }
        var destDomain = stopleak.getDomain(details.url);
        var sourceDomain = stopleak.tabCache.domain(details.tabId,
            details.frameId);
        // Ignore requests going to the same domain.
        if (sourceDomain === destDomain) {
            return allow;
        } else {
            return onBeforeCallback(details, sourceDomain, destDomain);
        }
    };
}

// Hook network requests

// Fires when a request is about to occur. This event is sent before any TCP
// connection is made and can be used to cancel or redirect requests.
chrome.webRequest.onBeforeRequest.addListener(
    filterCrossDomain(onBeforeRequest),
    stopleak.requestFilter,
    ['blocking', 'requestBody']);

// Fires when a request is about to occur and the initial headers have been
// prepared. The event is intended to allow extensions to add, modify, and
// delete request headers (Some headers are not provided). This event can be
// used to cancel the request.
chrome.webRequest.onBeforeSendHeaders.addListener(
    filterCrossDomain(onBeforeSendHeaders),
    stopleak.requestFilter,
    ['blocking', 'requestHeaders']);
