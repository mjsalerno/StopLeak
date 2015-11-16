/**
 * Created by michael on 11/15/15.
 */
/* global BLOCKED_STRINGS,  ALLOW, DENY, SCRUB, SWWL, CUSTOM_SETTINGS*/
/*exported getReqAction*/
'use strict';

var stopleak = {};

stopleak.PIIData = [];
stopleak.deny = [];
stopleak.allow = [];
stopleak.scrub = [];
stopleak.swwl = [];
stopleak.custSettings = {};

const ACTION_ALLOW = 'allow';
const ACTION_DENY = 'deny';
const ACTION_SCRUB = 'scrub';
const ACTION_UNKNOWN = 'unknown';

/**
 * Load user data from storage.
 */
function getUserData() {
    chrome.storage.sync.get(null, function (list) {
        stopleak.PIIData = list.hasOwnProperty(BLOCKED_STRINGS) ?  list[BLOCKED_STRINGS] : [];
        stopleak.deny = list.hasOwnProperty(DENY) ?  list[DENY] : [];
        stopleak.allow = list.hasOwnProperty(ALLOW) ?  list[ALLOW] : [];
        stopleak.scrub = list.hasOwnProperty(SCRUB) ?  list[SCRUB] : [];
        stopleak.swwl = list.hasOwnProperty(SWWL) ?  list[SWWL] : [];
        stopleak.custSettings = list.hasOwnProperty(CUSTOM_SETTINGS) ?  list[CUSTOM_SETTINGS] : {};
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

    if (changes.hasOwnProperty(SWWL)) {
        change = changes[SWWL];
        if (change.hasOwnProperty('newValue')) {
            stopleak.swwl = change.newValue;
        }
    }

    if (changes.hasOwnProperty(CUSTOM_SETTINGS)) {
        change = changes[CUSTOM_SETTINGS];
        if (change.hasOwnProperty('newValue')) {
            stopleak.custSettings = change.custSettings;
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

    var i, len;

    //check tuple thing -> [{src:'source domain', dst: 'dst domain', action: ACTION_*}, ...]
    len = stopleak.custSettings.length;
    for(i = 0; i < len; i++) {
        var map = stopleak.custSettings[i];
        if(map.src === src && map.dst === dst) {
            if(map.action !== ACTION_ALLOW || map.action !== ACTION_DENY ||
                map.action !== ACTION_SCRUB) {

                console.log('storage: invalid custom setting: ' + map);
                return ACTION_UNKNOWN;
            } else {
                return map.action;
            }
        }
    }

    //check deny list
    len = stopleak.deny.length;
    for(i = 0; i < len; i++) {
        if(stopleak.deny[i] === dst) {
            return ACTION_DENY;
        }
    }

    //check SWWL
    len = stopleak.swwl.length;
    for(i = 0; i < len; i++) {
        if(stopleak.swwl[i] === src) {
            return ACTION_ALLOW;
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
