'use strict';

chrome.runtime.onInstalled.addListener(function (details) {
  console.log('previousVersion', details.previousVersion);
});

chrome.browserAction.setBadgeText({text: '0'});

console.log('\'Allo \'Allo! Event Page for Browser Action');

/**
 * StopLeak namespace.
 * @namespace
 */
var stopleak = stopleak || {};

stopleak.blocks = {};

// Filter out request from the main frame (the
var requestFilter = {
  urls: ['<all_urls>'],
  types: ['sub_frame']
};

/**
 * Increments the number of block requests on tab tabId.
 * @param {number} tabId The id of the tab.
 */
function incBlockCount(tabId) {
  if(stopleak.blocks[tabId] === undefined) {
    stopleak.blocks[tabId] = 0;
  }
  stopleak.blocks[tabId] += 1;
}

/**
 * Modifies or blocks HTTP requests based on the request headers.
 * @param {!Object} details The HTTP request containing request headers.
 * @return {!Object} The BlockingResponse containing the modified request
 *    headers to send.
 */
function onBeforeSendHeaders(details) {
  if(details.tabId !== chrome.tabs.TAB_ID_NONE) {
    // Example code to delete User-Agent from request headers

    //for (var i = details.requestHeaders.length - 1; i >= 0; --i) {
    //   if (details.requestHeaders[i].name === 'User-Agent') {
    //     details.requestHeaders.splice(i, 1);
    //   }
    //}
    //console.log('Dropped User-Agent from tab ' + details.tabId);
  }
  return {requestHeaders: details.requestHeaders};
}

/**
 * Filters HTTP requests based on the requested url before TCP connection
 * is made.
 * @param {!Object} details The HTTP request before being sent.
 * @return {!Object} The BlockingResponse to allow or deny this request.
 */
function onBeforeRequest(details) {
  var cancel = {cancel: false};
  if(details.tabId !== chrome.tabs.TAB_ID_NONE) {
    console.log(details);
    var str = JSON.stringify(details);
    if(str.indexOf('shane') !== -1) {
      console.log('Blocking request to ' + details.url);
      incBlockCount(details.tabId);
      cancel.cancel = true;
    }
  }
  return cancel;
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  onBeforeSendHeaders,
  requestFilter,
  ['blocking', 'requestHeaders']);


chrome.webRequest.onBeforeRequest.addListener(
  onBeforeRequest,
  requestFilter,
  ['blocking', 'requestBody']);
