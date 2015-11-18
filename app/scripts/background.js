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
 * Checks whether this string contains any PII data.
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
 * @param {object} request The request to check.
 * @returns {boolean} True if the body contains PII data.
 */
function piiInRequestBody(request) {
    if(!request.hasOwnProperty('requestBody')) {
        return false;
    }
    var piiFound = false;
    var requestBody = request.requestBody;
    var data;
    if (requestBody.hasOwnProperty('formData')) {
        // If the request method is POST and the body is a sequence of
        // key-value pairs encoded in UTF8, encoded as either
        // multipart/form-data, or application/x-www-form-urlencoded, this
        // dictionary is present and for each key contains the list of all
        // values for that key. If the data is of another media type, or if
        // it is malformed, the dictionary is not present. An example value
        // of this dictionary is {'key': ['value1', 'value2']}.
        data = requestBody.formData;
    } else if (requestBody.hasOwnProperty('raw')) {
        // If the request method is PUT or POST, and the body is not already
        // parsed in formData, then the unparsed request body elements are
        // contained in this array.
        // raw is an array of UploadData
        data = requestBody.raw;
    }
    console.log(data);
    return piiFound;
}

/**
 * Checks whether this request's HTTP headers contain any PII data.
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
            return containsPIIdata(header.name) || containsPIIdata(headerValue);
        }
    }
    return piiFound;
}

/**
 * Checks whether this request contains any PII data.
 * @param {object} request The request to check.
 * @returns {boolean} True if the headers contain PII data.
 */
function piiInRequest(request) {
    return piiInRequestBody(request) || piiInRequestHeaders(request);
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
            return {cancel: piiInRequest(request)};
        case ACTION_UNKNOWN:
            if (piiInRequest(request)) {
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
            console.log('Dropped cookie dest:' + destOrigin + ', source:' +
                sourceOrigin + ' tab:' + request.tabId + ' frame:' +
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
 * Pass cross origin requests to the filter callback.
 * @param {function} onBeforeCallback Either onBeforeSendHeaders or
 *    onBeforeRequest.
 * @return {object} The BlockingResponse to allow or deny this request.
 */
function filterCrossTabOrigin(onBeforeCallback) {
    return function (details) {
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
