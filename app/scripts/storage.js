/**
 * Created by michael on 11/15/15.
 */
/* global BLOCKED_STRINGS,  ALLOW, DENY, SCRUB*/
/*exported getReqAction*/
'use strict';

var stopleak = stopleak || {};

stopleak.blocks = stopleak.blocks || {};
stopleak.tabDomain = stopleak.tabDomain || {};
stopleak.PIIData = stopleak.PIIData || [];
stopleak.deny = stopleak.deny || [];
stopleak.allow = stopleak.allow || [];
stopleak.scrub = stopleak.scrub || [];
stopleak.tabQueue = stopleak.tabQueue || [];

const ACTION_ALLOW = 'allow';
const ACTION_DENY = 'deny';
const ACTION_SCRUB = 'scrub';
const ACTION_UNKNOWN = 'unknown';

/**
 * Load user data from storage.
 */
function getUserData() {
    chrome.storage.sync.get(null, function (list) {
        stopleak.PIIData = list[BLOCKED_STRINGS];
        stopleak.deny = list[DENY];
        stopleak.allow = list[ALLOW];
        stopleak.scrub = list[SCRUB];
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
    var change;
    if (changes.hasOwnProperty(BLOCKED_STRINGS)) {
        change = changes[BLOCKED_STRINGS];
        if (change.hasOwnProperty('newValue')) {
            stopleak.PIIData = change.newValue;
        }
    }

    if (changes.hasOwnProperty(ALLOW)) {
        change = changes[ALLOW];
        if (change.hasOwnProperty('newValue')) {
            stopleak.allow = change.newValue;
        }
    }

    if (changes.hasOwnProperty(DENY)) {
        change = changes[DENY];
        if (change.hasOwnProperty('newValue')) {
            stopleak.deny = change.newValue;
        }
    }

    if (changes.hasOwnProperty(SCRUB)) {
        change = changes[SCRUB];
        if (change.hasOwnProperty('newValue')) {
            stopleak.scrub = change.newValue;
        }
    }
}

/**
 * Returns ACTION_ALLOW, ACTION_DENY, or ACTION_SCRUB
 * if a request is allowed, null if unknown
 * @param src source of request
 * @param dst destination of request
 */
function getReqAction(src, dst) {
    if(src === dst) {
        return ACTION_ALLOW;
    }

    //check deny list
    var len = stopleak.deny.length;
    var i;
    for(i = 0; i < len; i++) {
        if(stopleak.deny[i] === dst) {
            return ACTION_DENY;
        }
    }

    //check scrub list
    len = stopleak.scrub.length;
    for(i = 0; i < len; i++) {
        if(stopleak.scrub[i] === dst) {
            return ACTION_SCRUB;
        }
    }

    //check allow list
    len = stopleak.allow.length;
    for(i = 0; i < len; i++) {
        if(stopleak.allow[i] === dst) {
            return ACTION_ALLOW;
        }
    }

    return ACTION_UNKNOWN;
}


getUserData();
chrome.storage.onChanged.addListener(updateUserData);
