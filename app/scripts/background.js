'use strict';
/* global chrome, ACTION_ALLOW, ACTION_DENY, ACTION_SCRUB, ACTION_UNKNOWN,
    BLOCKED_STRINGS */

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

function getBlockedRequests(tabId) {
    //var blockedRequests = {
    //    type: 'blockedRequests',
    //    blockedRequests: {
    //        'adds.com': {
    //            'actions': {
    //                'block': 345, 'allow': 500, 'scrub': 357
    //            },
    //            // Store like extra PII content here?
    //            'extras': ['http://www.adds.com?user=cse509&location=USA',
    //                'email=cse509@cs.stonybrook.edu']
    //        },
    //        'scottharvey.com': {
    //            'actions': {
    //                'block': 0, 'allow': 5000, 'scrub': 0
    //            },
    //            'extras': []
    //        },
    //        'stackoverflow.com': {
    //            'actions': {
    //                'block': 0, 'allow': 352, 'scrub': 5
    //            },
    //            'extras': ['username=cse509']
    //        }
    //    }
    //};
    var blockedRequests = stopleak.tabCache.getRequests(tabId);
    console.log('[popup] requests for tab ' + tabId + ': ', blockedRequests);
    return blockedRequests;
}

chrome.runtime.onInstalled.addListener(function(details) {
    console.log('previousVersion', details.previousVersion);
});

/**
 * Add message to the list of reasons to block this request.
 *
 * @param {object} request The request to check.
 * @param {string} message Message explaining why this request was blocked.
 */
function addBlockMessage(request, message) {
    request.blockReasons.push(message);
}

/**
 * Checks whether this object contains any PII data and accumulates the found
 * information into the request.
 *
 * @param {object} request The request associated with this object..
 * @param {*} object The object to screen for PII.
 * @returns {boolean} True if the object contains PII data.
 */
function containsPIIdata(request, object) {
    var found = false;
    var pii;
    var lower = JSON.stringify(object).toLocaleLowerCase();
    var len = stopleak[BLOCKED_STRINGS].length;
    for (var i = 0; i < len; ++i) {
        pii = stopleak[BLOCKED_STRINGS][i];
        if (lower.indexOf(pii) !== -1) {
            request.piiFound[pii] = 1;
            found = true;
        }
    }
    return found;
}

/**
 * Checks whether this request url contains any PII data.
 *
 * @param {object} request The request to check.
 * @returns {boolean} True if the url contains PII data.
 */
function piiInRequestUrl(request) {
    var piiFound = false;
    var url = new URL(request.url);
    var tabURL = stopleak.tabCache.getTabURL(request.tabId);
    if (url.protocol !== 'https:' &&
        (url.password !== '' || url.username !== '')) {
        addBlockMessage(request, 'Sending username or password over an ' +
            'insecure connection.');
        piiFound = true;
    }
    var afterDomain = url.pathname + url.search + url.hash;
    if (tabURL.host !== '' && afterDomain.indexOf(tabURL.host) !== -1) {
        // current hostname info is leaking in this request
        addBlockMessage(request, 'Info about the current domain (' +
            tabURL.host + ') is present in this request.');
        piiFound = true;
    }
    // any PII data is leaking in this request
    if (containsPIIdata(request, afterDomain)) {
        piiFound = true;
    }
    return piiFound;
}

/**
 * Checks whether this request body contains any PII data.
 *
 * @param {object} request The request to check.
 * @returns {boolean} True if the body contains PII data.
 */
function piiInRequestBody(request) {
    var requestBody = stopleak.getRequestBody(request);
    return containsPIIdata(request, requestBody);
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
            requestHeaders.splice(i, 1);
        } else if (header.name === 'Referer') {
            // TODO: Is there PII in the referrer url, i.e. the current url of
            // this frame.
            requestHeaders.splice(i, 1);
        } else {
            // TODO: just naively check for PII?
            // JavaScript can add arbitrary headers to XMLHttpRequests using
            // the setRequestHeader() method.
            // w3.org/TR/XMLHttpRequest/#the-setrequestheader-method
            if (containsPIIdata(request, header.name + ':' + headerValue)) {
                piiFound = true;
            }
        }
    }
    // Fake the ETag header
    requestHeaders.push({
        name: 'If-None-Match',
        value: stopleak.getPseudoRandomString(32)
    });
    return piiFound;
}

/**
 * Checks whether this request contains any PII data.
 *
 * @param {object} request The request to check.
 * @returns {boolean} True if the request contains PII data.
 */
function piiInRequest(request) {
    // We want to report all leaks in the request
    var url = piiInRequestUrl(request);
    var body = piiInRequestBody(request);
    var headers = piiInRequestHeaders(request);
    return url || body || headers;
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
 * @param {object} details The HTTP request before being sent.
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
 * @param {object} details The HTTP request containing request headers.
 * @param {string} sourceOrigin The source origin.
 * @param {string} destOrigin The destination origin.
 * @return {object} The BlockingResponse to cancel this request or modify
 *     request headers.
 */
function onBeforeSendHeaders(details, sourceOrigin, destOrigin) {
    var request = fullRequest(details);
    var userAction = stopleak.getReqAction(sourceOrigin, destOrigin);
    var cancel = false;
    var sanitizedHeaders = request.requestHeaders;

    // Reasons why we choose to block this request
    request.blockReasons = [];
    request.piiFound = {};
    // Check if allow, deny, scrub, unknown using the full request
    switch (userAction) {
        case ACTION_ALLOW:
            break;
        case ACTION_SCRUB:
            // TODO: We can only cancel the request OR modify the HTTP headers
            // We can't modify the body of a request, e.g. formData, therefore
            // if there is PII in the requestBody I think we should cancel.
            cancel = piiInRequest(request);
            break;
        case ACTION_DENY:
            // TODO: Should we block unconditionally or only if PII is present?
            cancel = true;
            break;
        case ACTION_UNKNOWN:
            if (piiInRequest(request)) {
                // TODO: notify user's tab with content popup?
                cancel = true;
            }
            break;
        default:
            console.assert(false, 'Reached unreachable code!');
    }
    if (cancel) {
        stopleak.tabCache.saveRequest(request);
        stopleak.tabCache.incBlockCount(request.tabId);
        console.log('Cancelling request because:', request.blockReasons);
        console.log('PII found:', Object.keys(request.piiFound));
        return {cancel: cancel};
    }
    return {requestHeaders: sanitizedHeaders};
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
