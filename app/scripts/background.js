'use strict';
/* global BLOCKED_STRINGS,  ALLOW, DENY, USER_DENY, USER_ALLOW */

var Tab = function (tabId) {
    this.tabId = tabId;
    this.requestQueue = [];
    this.userDecisionQueue = [];
};

var userDecision = function (request, decision) {
    this.request = request;
    this.decision = decision;
};


/**
 * Return the domain name from a url.
 * @param {string} url Any url.
 */
function getDomain(url) {
    var host = new URL(url).hostname;

    return host.split('.').slice(-2).join('.');
}


/**
 * Return the value of the headerName in the provided request.
 * @param {object} request
 * @param {string} headerName
 * @returns {any} Returns the value or binaryValue of the header in the
 *     request, or null if he request is not present
 */
function requestGetHeader(request, headerName) {
    for (var j = 0; j < request.requestHeaders.length; ++j) {
        var header = request.requestHeaders[j];
        if (header.name === headerName) {
            if (header.hasOwnProperty('value')) {
                return header.value;
            } else if (header.hasOwnProperty('binaryValue')) {
                return header.binaryValue;
            }
        }
    }
    return null;
}

/**
 * Function that passes new decisions to user
 * @deny The stored user blacklist (i.e. stopleak.deny)
 * @allow The stored user whitelist (i.e. stopleak.allow)
 */
Tab.prototype.screenRequests = function (deny, allow) {
    for (var i = 0; i < this.requestQueue.length; ++i) {
        var request = this.requestQueue[i];
        // Origin header is always present in third party requests
        if (requestGetHeader(request, 'Origin') === null) {
            continue;
        }

        var domain = getDomain(request.url);

        //TODO(shane): if needed we could optimize with a binary search
        for (var j = 0; j < deny.length; ++j) {
            //if a blocked domain composes a part of the request url then mark it denied
            if (domain === deny[j]) {
                this.userDecisionQueue.push(new userDecision(request, USER_DENY));
            }
        }
        for (j = 0; j < allow.length; ++j) {
            //if a blocked domain composes a part of the request url then mark it denied
            if (domain === allow[j]) {
                this.userDecisionQueue.push(new userDecision(request, USER_ALLOW));
            }
        }
    }
};

chrome.runtime.onInstalled.addListener(function (details) {
    console.log('previousVersion', details.previousVersion);
});

chrome.browserAction.setBadgeText({text: '0'});

/**
 * StopLeak namespace.
 * @namespace
 */
var stopleak = stopleak || {};

stopleak.blocks = {};
stopleak.PIIData = [];
stopleak.deny = [];
stopleak.allow = [];
stopleak.tabs = {};


/*
 Assign user PII data (key is 'filter') to stopleak.PIIData
 */

/**
 * Load user data from storage.
 */
function getUserData() {
    chrome.storage.sync.get(BLOCKED_STRINGS, function (items) {
        stopleak.PIIData = items[BLOCKED_STRINGS];
        stopleak.deny = items[DENY];
        stopleak.allow = items[ALLOW];
    });
}

/**
 * Update the user data that has changed.
 * @param {Object} changes Object mapping each key that changed to its
 *     corresponding storage.StorageChange for that item.
 * @param {string} areaName The name of the storage area ("sync", "local" or
 *     "managed") the changes are for.
 */
function updateUserData(changes, areaName) {
    console.log('Syncing user data update from ' + areaName);
    if (changes.hasOwnProperty(BLOCKED_STRINGS)) {
        var change = changes[BLOCKED_STRINGS];
        if (change.hasOwnProperty('newValue')) {
            stopleak.PIIData = change.newValue;
        }
    }
}

getUserData();
chrome.storage.onChanged.addListener(updateUserData);

// Filter out request from the main frame (the
stopleak.requestFilter = {
    urls: ['<all_urls>']
};

//function setUserData(object) {
//    chrome.storage.sync.set({object});
//}
//
//function removeUserData(object) {
//    chrome.storage.sync.remove(object);
//}

/**
 * Modifies or blocks HTTP requests based on the request headers.
 * @param {!Object} details The HTTP request containing request headers.
 * @param {string} destDomain The destination domain.
 * @return {object} The BlockingResponse containing the modified request
 *    headers to send.
 */
function onBeforeSendHeaders(details, destDomain) {
    // Delete third party cookies
    for (var i = details.requestHeaders.length - 1; i >= 0; --i) {
        if (details.requestHeaders[i].name === 'Cookie') {
            details.requestHeaders.splice(i, 1);
            console.log('Dropped cookie for ' + destDomain);
            stopleak.tabCache.incBlockCount(details.tabId);
        }
    }
    return {requestHeaders: details.requestHeaders};
}

/**
 * Filters HTTP requests based on the requested url before TCP connection
 * is made.
 * @param {!Object} details The HTTP request before being sent.
 * @param {string} destDomain The destination domain.
 * @return {object} The BlockingResponse to allow or deny this request.
 */
function onBeforeRequest(details, destDomain) {
    var cancel = false;
    var tab;

    // Lookup the request (sourceDomain, destDomain) in the

    if (stopleak.tabs.hasOwnProperty(details.tabId)) {
        tab = stopleak.tabs[details.tabId];
    } else {
        tab = new Tab(details.tabId);
        stopleak.tabs[tab.tabId] = tab;
    }
    tab.requestQueue.push(details);

    //console.debug(details);
    var str = JSON.stringify(details);

    //XX
    //Add: if not in whitelist
    //We rely on the origin field in the header to know whether or not it is a third party request
    //Origin is automatically added by browser.
    //However "Origin" is not added if a GET request.
    //So data could still be leaked through query params.
    //The problem remains that we don't know the domain

    //XX
    //This has to be changed so that it just looks at the tabs request queue and the answers that the user
    //Provided via the interface/whitelist/blacklist
    for (var i = 0; i < stopleak.PIIData.length; ++i) {
        if (str.indexOf(stopleak.PIIData[i]) !== -1) {
            console.debug('Blocking request to ' + destDomain);
            stopleak.tabCache.incBlockCount(details.tabId);
            cancel = true;
            break;
        }
    }
    return {cancel: cancel};
}

/**
 * Pass cross domain requests to the filter callback.
 * @param {function} onBeforeCallback Either onBeforeSendHeaders or
 *    onBeforeRequest.
 * @return {object} The BlockingResponse to allow or deny this request.
 */
function filterCrossDomain(onBeforeCallback) {
    return function (details) {
        var destDomain = getDomain(details.url);
        // Ignore requests going to the same domain.
        if (details.type === 'main_frame' ||
            details.tabId === chrome.tabs.TAB_ID_NONE ||
            destDomain === stopleak.tabCache.domain(details.tabId, details.frameId)) {
            return;
        }
        // console.log(details);
        // alert('Check the stop leak dropdown');
        // console.log('Do I work?');
        return onBeforeCallback(details, destDomain);
    };
}

// Hook network requests
chrome.webRequest.onBeforeSendHeaders.addListener(
    filterCrossDomain(onBeforeSendHeaders),
    stopleak.requestFilter,
    ['blocking', 'requestHeaders']);


chrome.webRequest.onBeforeRequest.addListener(
    filterCrossDomain(onBeforeRequest),
    stopleak.requestFilter,
    ['blocking', 'requestBody']);
