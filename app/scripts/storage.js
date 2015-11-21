/**
 * Created by michael on 11/15/15.
 */
/* global chrome, BLOCKED_STRINGS,  ALLOW, DENY, SCRUB, SWWL, CUSTOM_SETTINGS */
'use strict';

var stopleak = stopleak || {};

stopleak[BLOCKED_STRINGS] = [];
stopleak[DENY] = [];
stopleak[ALLOW] = [];
stopleak[SCRUB] = [];
stopleak[SWWL] = [];
stopleak[CUSTOM_SETTINGS] = {};

const ACTION_ALLOW = 'allow';
const ACTION_DENY = 'deny';
const ACTION_SCRUB = 'scrub';
const ACTION_UNKNOWN = 'unknown';

/**
 * Gets the settings from the in mem storage, formats the
 * cust settings as a list so the UI can easily read it.
 *
 * @param {String} setting one of the constants (e.g. CUSTOM_SETTINGS)
 * @returns {Array}
 */
function getSyncStorage(setting) {
    var rtn = [];

    switch (setting) {
        case CUSTOM_SETTINGS:
            for (var src in stopleak[CUSTOM_SETTINGS]) {
                for (var dst in stopleak[CUSTOM_SETTINGS][src]) {
                    rtn.push([src, dst, stopleak[CUSTOM_SETTINGS][src][dst]]);
                }
            }
            break;

        case ALLOW:
        /* falls through */
        case SCRUB:
        /* falls through */
        case DENY:
        /* falls through */
        case SWWL:
        /* falls through */
        case BLOCKED_STRINGS:
            rtn =  stopleak[setting];
            break;

        default:
            console.log('do not know how to get: ' + setting);
            rtn = null;
            break;
    }

    return rtn;
}

/**
 * deletes one of the settings.
 *
 * @param {String} setting setting one of the constants (e.g. CUSTOM_SETTINGS)
 * @param {Object} map the values of the
 * @param {Function} onSuccess a function to call once this succeeded
 * @param {Object} args the args to pass to the onSuccess function
 * @param {Function} onError a function to call if this fails
 * @param {Object} arge the args to pass to the onSuccess function
 */
function delSyncStorage(setting, map, onSuccess, args, onError, arge) {
    var tmp;
    var a;
    if (!stopleak.hasOwnProperty(setting)) {
        if (onError !== null) {
            onError(arge);
        }
        console.log('storage: could not find that setting: ' + setting);
        return;
    }

    switch (setting) {
        case CUSTOM_SETTINGS:
            if (!map.src || !map.dst || !map.action) {
                console.log('storage: missing arg in map (src/dst/action)');
                return;
            }

            if (stopleak[CUSTOM_SETTINGS].hasOwnProperty(map.src)) {
                tmp = stopleak[CUSTOM_SETTINGS][map.src];
                if (tmp.hasOwnProperty(map.dst)) {
                    delete tmp[map.dst];
                    a = {};
                    a[CUSTOM_SETTINGS] = stopleak[CUSTOM_SETTINGS];
                    chrome.storage.sync.set(a, function() {
                        if (onSuccess !== null) {
                            onSuccess(args);
                        }
                    });
                } else {
                    onError(arge);
                }
            }
            break;

        case ALLOW:
            /* falls through */
        case SCRUB:
            /* falls through */
        case DENY:
            /* falls through */
        case SWWL:
            /* falls through */
        case BLOCKED_STRINGS:
            if (!map.val) {
                onError(arge);
                console.log('storage: missing key in map, val');
                return;
            }

            if (stopleak[setting].indexOf(map.val) > -1) {
                onError(arge);
                return;
            }

            stopleak[setting].push(map.val);
            a  = {};
            a[setting] = stopleak[setting];
            chrome.storage.sync.set(a, function() {
                onSuccess(args);
            });
            break;

        default:
            console.log('do not know how to get: ' + setting);
            onerror(arge);
            break;
    }
}

function updateSyncSetting(setting, map, onsuccess, argss, onError, argse) {

    if (!stopleak.hasOwnProperty(setting)) {
        onError(argss);
        console.log('storage: could not find that setting: ' + setting);
        return;
    }

    switch (setting) {
        case CUSTOM_SETTINGS:
            chrome.storage.sync.get(null, function(items) {
                var custSett = items[CUSTOM_SETTINGS] || {};
                var inCustSett = custSett[map.src] || {};

                inCustSett[map.dst] = map.action;
                custSett[map.src] = inCustSett;
                items[CUSTOM_SETTINGS] = custSett;

                chrome.storage.sync.set(items, function() {
                    if (onsuccess !== null) {
                        onsuccess(argss);
                    }
                });
            });
            break;

        case ALLOW:
        /* falls through */
        case SCRUB:
        /* falls through */
        case DENY:
        /* falls through */
        case SWWL:
        /* falls through */
        case BLOCKED_STRINGS:
            if (!map.val) {
                onError(argse);
                console.log('storage: missing key in map, val');
                return;
            }

            if (stopleak[setting].indexOf(map.val) > -1) {
                return;
            }

            stopleak[setting].push(map.val);
            var a  = {};
            a[setting] = stopleak[setting];
            chrome.storage.sync.set(a, function() {
                onsuccess(argss);
            });
            break;
        default:
            console.log('do not know how to get: ' + setting);
            onerror(argse);
            break;
    }
}

/**
 * Load user data from storage.
 */
function getUserData() {
    chrome.storage.sync.get(null, function(list) {
        stopleak[BLOCKED_STRINGS] = list.hasOwnProperty(BLOCKED_STRINGS) ?
            list[BLOCKED_STRINGS] : [];

        stopleak[DENY] = list.hasOwnProperty(DENY) ?  list[DENY] : [];

        stopleak[ALLOW] = list.hasOwnProperty(ALLOW) ?  list[ALLOW] : [];

        stopleak[SCRUB] = list.hasOwnProperty(SCRUB) ?  list[SCRUB] : [];

        stopleak[SWWL] = list.hasOwnProperty(SWWL) ?  list[SWWL] : [];

        stopleak[CUSTOM_SETTINGS] = list.hasOwnProperty(CUSTOM_SETTINGS) ?
            list[CUSTOM_SETTINGS] : {};
    });
}

/**
 * Update the user data that has changed.
 *
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
            stopleak[BLOCKED_STRINGS] = change.newValue || [];
        }
    }

    if (changes.hasOwnProperty(ALLOW)) {
        change = changes[ALLOW];
        if (change.hasOwnProperty('newValue')) {
            stopleak[ALLOW] = change.newValue || [];
        }
    }

    if (changes.hasOwnProperty(DENY)) {
        change = changes[DENY];
        if (change.hasOwnProperty('newValue')) {
            stopleak[DENY] = change.newValue || [];
        }
    }

    if (changes.hasOwnProperty(SCRUB)) {
        change = changes[SCRUB];
        if (change.hasOwnProperty('newValue')) {
            stopleak[SCRUB] = change.newValue || [];
        }
    }

    if (changes.hasOwnProperty(SWWL)) {
        change = changes[SWWL];
        if (change.hasOwnProperty('newValue')) {
            stopleak[SWWL] = change.newValue || [];
        }
    }

    if (changes.hasOwnProperty(CUSTOM_SETTINGS)) {
        change = changes[CUSTOM_SETTINGS];
        if (change.hasOwnProperty('newValue')) {
            stopleak[CUSTOM_SETTINGS] = change.custSettings || {};
        }
    }
}

/**
 * Returns ACTION_ALLOW, ACTION_DENY, or ACTION_SCRUB
 * if a request is allowed, null if unknown
 *
 * @param {String} src source of request
 * @param {String} dst destination of request
 */
stopleak.getReqAction = function(src, dst) {
    if (src === dst) {
        return ACTION_ALLOW;
    }

    var i;
    var len;

    //check cust settings
    if (stopleak[CUSTOM_SETTINGS].hasOwnProperty(src) &&
        stopleak[CUSTOM_SETTINGS][src].hasOwnProperty(dst)) {

        var action = stopleak[CUSTOM_SETTINGS][src][dst];

        if (action !== ACTION_ALLOW || action !== ACTION_DENY ||
            action !== ACTION_SCRUB) {

            console.log('storage: invalid custom setting: ' + action);
            return ACTION_UNKNOWN;
        } else {
            return action;
        }
    }

    //check deny list
    len = stopleak[DENY].length;
    for (i = 0; i < len; i++) {
        if (stopleak[DENY][i] === dst) {
            return ACTION_DENY;
        }
    }

    //check SWWL
    len = stopleak[SWWL].length;
    for (i = 0; i < len; i++) {
        if (stopleak[SWWL][i] === src) {
            return ACTION_ALLOW;
        }
    }

    //check scrub list
    len = stopleak[SCRUB].length;
    for (i = 0; i < len; i++) {
        if (stopleak[SCRUB][i] === dst) {
            return ACTION_SCRUB;
        }
    }

    //check allow list
    len = stopleak[ALLOW].length;
    for (i = 0; i < len; i++) {
        if (stopleak[ALLOW][i] === dst) {
            return ACTION_ALLOW;
        }
    }

    return ACTION_UNKNOWN;
};

getUserData();
chrome.storage.onChanged.addListener(updateUserData);
