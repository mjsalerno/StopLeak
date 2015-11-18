'use strict';

var stopleak = stopleak || {};

var TabCache = function () {
    this.tabs = {}; // Maps tab id's to tabs
};

/**
 * Return Tab with the given tabId.
 * @param {number} tabId ID of the tab.
 * @return {object} tab
 */
TabCache.prototype.getTab = function (tabId) {
    if (!this.tabs.hasOwnProperty(tabId)) {
        this.tabs[tabId] = {blocks: 0};
    }
    return this.tabs[tabId];
};

/**
 * Updates the url for the provided frame.
 * @param {number} tabId ID of the tab.
 * @param {number} frameId ID of frame within this tab.
 * @param {string} url URL associated with the frame.
 */
TabCache.prototype.updateUrl = function (tabId, frameId, url) {
    var tab = this.getTab(tabId);
    var origin = stopleak.extractOrigin(url);
    tab[frameId] = {
        url: url,
        origin: origin
    };
    console.log('Updated tab:' + tabId + ' frame:' + frameId + ' origin: ' + origin);
};

/**
 * Get the origin for the provided frame within a tab.
 * @param {number} tabId ID of the tab.
 * @param {number} frameId ID of frame within this tab.
 * @return {string} origin of the frame
 */
TabCache.prototype.getFrameOrigin = function (tabId, frameId) {
    if (this.tabs.hasOwnProperty(tabId) &&
        this.tabs[tabId].hasOwnProperty(frameId)) {
        return this.tabs[tabId][frameId].origin;
    }
    return '';
};

/**
 * Get the origin for the provided tab.
 * @param {number} tabId ID of the tab.
 * @return {string} origin of the tab
 */
TabCache.prototype.getTabOrigin = function (tabId) {
    return this.getFrameOrigin(tabId, 0);
};

/**
 * Increments the number of block requests on tab tabId.
 * @param {number} tabId The id of the tab.
 */
TabCache.prototype.incBlockCount = function (tabId) {
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
 * Fired when the reference fragment of a frame was updated. All future events
 * for that frame will use the updated URL.
 *
 * @param {object} details Info about the frame and tab that was updated.
 */
function onReferenceFragmentUpdated(details) {
    stopleak.tabCache.updateUrl(details.tabId, details.frameId, details.url);
}

/**
 * Fired when the contents of the tab is replaced by a different (usually
 * previously pre-rendered) tab.
 *
 * @param {object} details Info about the replaced tab.
 */
function onTabReplaced(details) {
    stopleak.tabCache.tabs[details.tabId] = stopleak.tabCache.tabs[details.replacedTabId];
    delete stopleak.tabCache.tabs[details.replacedTabId];
}

/**
 * Fired when a tab is closed.
 * @param {int} tabId Id of removed tab.
 */
function onRemoved(tabId) {
    delete stopleak.tabCache.tabs[tabId];
}

/**
 * Save all frames from the given tab.
 *
 * @param {number} tabId ID of the tab.
 */
function getAllFrames(tabId) {
    chrome.webNavigation.getAllFrames({tabId: tabId}, function (detailsArray) {
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
    chrome.tabs.query({}, function (tabs) {
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
chrome.webNavigation.onReferenceFragmentUpdated.addListener(onReferenceFragmentUpdated);
chrome.webNavigation.onTabReplaced.addListener(onTabReplaced);
