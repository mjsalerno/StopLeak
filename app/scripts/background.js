'use strict';

chrome.runtime.onInstalled.addListener(function (details) {
  console.log('previousVersion', details.previousVersion);
});

chrome.browserAction.setBadgeText({text: '\'Allo'});

console.log('\'Allo \'Allo! Event Page for Browser Action');


// https://developer.chrome.com/extensions/webRequest#event-onBeforeSendHeaders
var requests = [];

chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
    for (var i = details.requestHeaders.length - 1; i >= 0; --i) {
      // Example code to delete user-agent and refer from requests
      // if (details.requestHeaders[i].name === 'User-Agent') {
      //   details.requestHeaders.splice(i, 1);
      // } else if (details.requestHeaders[i].name === 'Referer') {
      //   details.requestHeaders.splice(i, 1);
      // }
    }
    console.log(details);
    return {requestHeaders: details.requestHeaders};
  },
  {urls: ['<all_urls>']},
  ['blocking', 'requestHeaders']);

chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    console.log(details);
    requests.push(details);
    var str = JSON.stringify(details);
    if(str.indexOf('shane') !== -1) {
      console.log('Blocking request to ' + details.url);
      return {cancel: true};
    }
    return {cancel: false};
  },
  {urls: ['<all_urls>']},
  ['blocking', 'requestBody']);
