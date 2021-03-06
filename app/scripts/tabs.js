'use strict';

var stopleak = stopleak || {};

/**
 * Stores info about the currently open tabs.
 *
 * @constructor
 */
var TabCache = function() {
    this.tabs = {}; // Maps tab id's to tabs
};

/**
 * Return Tab with the given tabId.
 *
 * @param {number} tabId ID of the tab.
 * @return {object} tab
 */
TabCache.prototype.getTab = function(tabId) {
    if (!this.tabs.hasOwnProperty(tabId)) {
        // requests: Maps requestsId's to requests
        this.tabs[tabId] = {
            blocks: 0,
            requests: {}
        };
    }
    return this.tabs[tabId];
};

/**
 * Updates the url for the provided frame.
 *
 * @param {number} tabId ID of the tab.
 * @param {number} frameId ID of frame within this tab.
 * @param {string} url URL associated with the frame.
 */
TabCache.prototype.updateUrl = function(tabId, frameId, url) {
    if (frameId === 0) {
        // Reset this tab
        delete this.tabs[tabId];
    }
    var tab = this.getTab(tabId);
    tab[frameId] = new URL(url);
    //console.log('Updated tab:' + tabId + ' frame:' + frameId + ' origin: ' +
    //    tab[frameId].origin);
};

/**
 * Save a request that was blocked by us, so the user can see it later.
 *
 * @param {object} request The blocked request to save, has a 'tabId'.
 */
TabCache.prototype.saveRequest = function(request) {
    var tab = this.getTab(request.tabId);
    tab.requests[request.requestId] = request;
};

/**
 * Get all requests that were blocked by us, so the user can see it later.
 *
 * @param {object} tabId ID of the tab.
 */
TabCache.prototype.getRequests = function(tabId) {
    var tab = this.getTab(tabId);
    return tab.requests;
};

/**
 * Delete a request that was blocked. Called after the user chooses an option.
 *
 * @param {number} tabId ID of the tab.
 * @param {object} requestId The ID of the blocked request to delete.
 */
TabCache.prototype.delRequest = function(tabId, requestId) {
    var tab = this.getTab(tabId);
    delete tab.requests[requestId];
};

/**
 * Get the origin for the provided frame within a tab.
 *
 * @param {number} tabId ID of the tab.
 * @param {number} frameId ID of frame within this tab.
 * @return {URL} url of the frame
 */
TabCache.prototype.getFrameURL = function(tabId, frameId) {
    if (this.tabs.hasOwnProperty(tabId) &&
        this.tabs[tabId].hasOwnProperty(frameId)) {
        return this.tabs[tabId][frameId];
    }
    return new URL('');
};

/**
 * Get the URL for the provided tab.
 *
 * @param {number} tabId ID of the tab.
 * @return {URL} URL of the tab
 */
TabCache.prototype.getTabURL = function(tabId) {
    return this.getFrameURL(tabId, 0);
};

/**
 * Get the origin for the provided tab.
 *
 * @param {number} tabId ID of the tab.
 * @return {string} origin of the tab
 */
TabCache.prototype.getTabOrigin = function(tabId) {
    return this.getFrameURL(tabId, 0).origin;
};

/**
 * Increments the number of block requests on tab tabId.
 *
 * @param {number} tabId The id of the tab.
 */
TabCache.prototype.incBlockCount = function(tabId) {
    var tab = this.getTab(tabId);
    tab.blocks += 1;
    // NOTE: setBadgeText may print an error saying no such tab.
    chrome.browserAction.setBadgeText({
        text: '' + tab.blocks,
        tabId: tabId
    });
};

/**
 * Fired when a navigation is committed. The document (and the resources it
 * refers to, such as images and subframes) might still be downloading, but at
 * least part of the document has been received from the server and the browser
 * has decided to switch to the new document.
 *
 * @param {object} details Info about the frame and tab that was committed.
 */
function onCommitted(details) {
    stopleak.tabCache.updateUrl(details.tabId, details.frameId, details.url);
}

/**
 * Fired when a tab is closed.
 *
 * @param {int} tabId Id of removed tab.
 */
function onRemoved(tabId) {
    delete stopleak.tabCache.tabs[tabId];
}

/**
 * Fired when the contents of the tab is replaced by a different (usually
 * previously pre-rendered) tab.
 *
 * @param {object} details Info about the replaced tab.
 */
function onTabReplaced(details) {
    delete stopleak.tabCache.tabs[details.replacedTabId];
}

/**
 * Save all frames from the given tab.
 *
 * @param {number} tabId ID of the tab.
 */
function getAllFrames(tabId) {
    chrome.webNavigation.getAllFrames({tabId: tabId}, function(detailsArray) {
        for (var i = 0; i < detailsArray.length; ++i) {
            var details = detailsArray[i];
            stopleak.tabCache.updateUrl(tabId, details.frameId, details.url);
        }
    });
}

/**
 * Save all frames from all the current tabs.
 */
function initTabCache() {
    chrome.tabs.query({}, function(tabs) {
        for (var i = 0; i < tabs.length; ++i) {
            getAllFrames(tabs[i].id);
        }
    });
}

// Init the tab cache
stopleak.tabCache = new TabCache();
initTabCache();

chrome.tabs.onRemoved.addListener(onRemoved);
chrome.webNavigation.onCommitted.addListener(onCommitted);
chrome.webNavigation.onTabReplaced.addListener(onTabReplaced);
