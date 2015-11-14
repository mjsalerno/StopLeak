'use strict';
/* global BLOCKED_STRINGS */

chrome.extension.onMessage.addListener(function(message,sender,sendResponse) {
    if(message.text === 'getStuff') {
        sendResponse({stuff:'test'}); //This would be where you send your stuff
    }
    console.log('Received a message');
});

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
stopleak.tabDomain = {};
stopleak.PIIData = [];


/*
 Assign user PII data (key is 'filter') to stopleak.PIIData
 */

/**
 * Load user data from storage.
 */
function getUserData() {
    chrome.storage.sync.get(BLOCKED_STRINGS, function (list) {
        stopleak.PIIData = list.BLOCKED_STRINGS;
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
 * Return the domain name from a url.
 * @param {string} url Any url.
 */
function getDomain(url) {
    var host = new URL(url).hostname;

    return host.split('.').slice(-2).join('.');
}

// Tab urls
/**
 * Fired when a tab is created. Note that the tab's URL may not be set at the
 * time this event fired.
 * @param {object} tab Details of the tab that was created.
 */
function onCreated(tab) {
    if (tab.hasOwnProperty('id') &&
        tab.id !== chrome.tabs.TAB_ID_NONE &&
        tab.hasOwnProperty('url')) {
        stopleak.tabDomain[tab.id] = getDomain(tab.url);
    }
}

/**
 * Fired when a tab is updated.
 * @param {int} tabId Id of updated tab.
 * @param {object} changeInfo Lists the changes to the state of the tab that
 *     was updated.
 */
function onUpdated(tabId, changeInfo) {
    if (changeInfo.hasOwnProperty('url')) {
        stopleak.tabDomain[tabId] = getDomain(changeInfo.url);
    }
}

/**
 * Fired when a tab is closed.
 * @param {int} tabId Id of removed tab.
 */
function onRemoved(tabId) {
    delete stopleak.tabDomain[tabId];
}

/**
 * Fired when a tab is replaced with another tab due to prerendering or
 * instant.
 * @param {int} addedTabId Id of added tab.
 * @param {int} removedTabId Id of removed tab.
 */
function onReplaced(addedTabId, removedTabId) {
    stopleak.tabDomain[addedTabId] = stopleak.tabDomain[removedTabId];
    delete stopleak.tabDomain[removedTabId];
}

/**
 * Increments the number of block requests on tab tabId.
 * @param {number} tabId The id of the tab.
 */
function incBlockCount(tabId) {
    if (stopleak.blocks[tabId] === undefined) {
        stopleak.blocks[tabId] = 0;
    }
    stopleak.blocks[tabId] += 1;
    // NOTE: setBadgeText may print an error saying no such tab.
    chrome.browserAction.setBadgeText({
        text: '' + stopleak.blocks[tabId],
        tabId: tabId
    });
}

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
            incBlockCount(details.tabId);
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

    //console.debug(details);
    var str = JSON.stringify(details);
    for (var blockString in stopleak.PIIData) {
        if (str.indexOf(stopleak.PIIData[blockString]) !== -1) {
            console.debug('Blocking request to ' + destDomain);
            incBlockCount(details.tabId);
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
            destDomain === stopleak.tabDomain[details.tabId]) {
            return;
        }
        // console.log(details);
        // alert('Check the stop leak dropdown');
        // console.log('Do I work?');
        return onBeforeCallback(details, destDomain);
    };
}

// Tab urls
chrome.tabs.onCreated.addListener(onCreated);
chrome.tabs.onUpdated.addListener(onUpdated);
chrome.tabs.onRemoved.addListener(onRemoved);
chrome.tabs.onReplaced.addListener(onReplaced);

// Init tabs
chrome.tabs.query({}, function (tabs) {
    for (var i = 0; i < tabs.length; ++i) {
        onCreated(tabs[i]);
    }
});

// Hook network requests
chrome.webRequest.onBeforeSendHeaders.addListener(
    filterCrossDomain(onBeforeSendHeaders),
    stopleak.requestFilter,
    ['blocking', 'requestHeaders']);


chrome.webRequest.onBeforeRequest.addListener(
    filterCrossDomain(onBeforeRequest),
    stopleak.requestFilter,
    ['blocking', 'requestBody']);
