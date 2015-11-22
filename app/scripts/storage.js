/**
 * Created by michael on 11/15/15.
 */
/* global chrome, BLOCKED_STRINGS, SETTINGS, CUSTOM_SETTINGS, SWWL,
ACTION_ALLOW, ACTION_DENY, ACTION_SCRUB, ACTION_UNKNOWN */
'use strict';

var stopleak = stopleak || {};

stopleak[BLOCKED_STRINGS] = [];
stopleak[SETTINGS] = [];
stopleak[CUSTOM_SETTINGS] = {};

/**
 * Checks if an object has no keys
 *
 * @param {Object} obj the object to check
 * @returns {boolean}
 */
function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

function isValidAction(action) {
    return action === ACTION_ALLOW || action === ACTION_DENY ||
        action === ACTION_SCRUB;
}

/**
 * deletes one of the settings.
 *
 * @param {String} setting setting one of the constants (e.g. CUSTOM_SETTINGS)
 * @param {Object} map the values of the
 * @param {Function} onSuccess a function to call once this succeeded
 * @param {Function} onError a function to call if this fails
 */
function delSyncStorage(setting, map, onSuccess, onError) {
    var tmp;
    var a;
    if (!stopleak.hasOwnProperty(setting)) {
        if (onError !== null) {
            onError();
        }
        console.log('storage: could not find that setting: ' + setting);
        return;
    }

    switch (setting) {
        case CUSTOM_SETTINGS:
            if (!map.src || !map.dst || !map.action) {
                console.log('storage: missing arg in map (src/dst/action)');
                if (onError !== null) {
                    onError();
                }
                return;
            }

            if (stopleak[CUSTOM_SETTINGS].hasOwnProperty(map.src)) {
                tmp = stopleak[CUSTOM_SETTINGS][map.src];
                if (tmp.hasOwnProperty(map.dst)) {
                    delete stopleak[CUSTOM_SETTINGS][map.src][map.dst];
                    if (isEmpty(stopleak[CUSTOM_SETTINGS][map.src])) {
                        delete stopleak[CUSTOM_SETTINGS][map.src];
                    }
                    a = {};
                    a[CUSTOM_SETTINGS] = stopleak[CUSTOM_SETTINGS];
                    chrome.storage.sync.set(a, function() {
                        if (onSuccess !== null) {
                            onSuccess();
                        }
                    });
                } else {
                    if (onError !== null) {
                        onError();
                    }
                }
            }
            break;

        case SETTINGS:
            if (!map.val) {
                onError();
                console.log('storage: missing key in map, val');
                return;
            }

            if (stopleak[SETTINGS].hasOwnProperty(map.val)) {
                delete stopleak[SETTINGS][map.val];
                if (onSuccess !== null) {
                    onSuccess();
                } else {
                    if (onError !== null) {
                        onError();
                    }
                }
            }
            break;
        case SWWL:
            /* falls through */
        case BLOCKED_STRINGS:
            if (!map.val) {
                onError();
                console.log('storage: missing key in map, val');
                return;
            }

            if (stopleak[setting].indexOf(map.val) > -1) {
                onError();
                return;
            }

            stopleak[setting].push(map.val);
            a  = {};
            a[setting] = stopleak[setting];
            chrome.storage.sync.set(a, function() {
                onSuccess();
            });
            break;

        default:
            console.log('do not know how to get: ' + setting);
            onerror();
            break;
    }
}

/**
 * Appends a setting to an existing setting
 *
 * @param {String} setting the settings key to modify (e.g. CUSTOM_SETTINGS)
 * @param {Object} map the map containing the setting to be added.
 * @param {Function} onSuccess a function to call if this succeeds
 * @param {Function} onError a function to call if this fails
 */
function updateSyncSetting(setting, map, onSuccess, onError) {

    if (!stopleak.hasOwnProperty(setting)) {
        if (onError !== null) {
            onError();
        }
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
                    if (onSuccess !== null) {
                        onSuccess();
                    }
                });
            });
            break;

        case SETTINGS:
            if (!map.val || !map.action) {
                console.log('storage: missing val or action in map');
                if (onError !== null) {
                    onError();
                }
                return;
            }

            if (!isValidAction(map.action)) {
                console.log('storage: not a valid action - ' + map.action);
                if (onError !== null) {
                    onError();
                }
                return;
            }
            stopleak[SETTINGS][map.val] = map.action;
            if (onSuccess !== null) {
                onSuccess();
            }
            break;
        case SWWL:
            // if not BLOCKED_STRINGS and not CUSTOM_SETTINGS
            if (map.val) {
                try {
                    var u = new URL(map.val);
                    console.log('storage: adding addingURL: ', u);
                    map.val = u.origin;
                } catch (err) {
                    console.log('storage: url not correct format - ' + map.val);
                    if (onError !== null) {
                        onError();
                    }
                    return;
                }
            }
        /* falls through */
        case BLOCKED_STRINGS:
            if (!map.val) {
                if (onError !== null) {
                    onError();
                }
                console.log('storage: missing key in map, val');
                return;
            } else {
                map.val = map.val.toLocaleLowerCase();
            }

            if (stopleak[setting].indexOf(map.val) > -1) {
                return;
            }

            stopleak[setting].push(map.val);
            var a  = {};
            a[setting] = stopleak[setting];
            chrome.storage.sync.set(a, function() {
                if (onSuccess !== null) {
                    onSuccess();
                }
            });
            break;
        default:
            console.log('do not know how to get: ' + setting);
            if (onError !== null) {
                onError();
            }
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

        stopleak[SETTINGS] = list.hasOwnProperty(SETTINGS) ?
            list[SETTINGS] : [];

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
        stopleak[BLOCKED_STRINGS] = change.newValue || [];
    }

    if (changes.hasOwnProperty(SETTINGS)) {
        change = changes[SETTINGS];
        stopleak[SETTINGS] = change.newValue || {};
    }

    if (changes.hasOwnProperty(SWWL)) {
        change = changes[SWWL];
        stopleak[SWWL] = change.newValue || [];
    }

    if (changes.hasOwnProperty(CUSTOM_SETTINGS)) {
        change = changes[CUSTOM_SETTINGS];
        stopleak[CUSTOM_SETTINGS] = change.newValue || {};
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
    var action;

    //check cust settings
    if (stopleak[CUSTOM_SETTINGS].hasOwnProperty(src) &&
        stopleak[CUSTOM_SETTINGS][src].hasOwnProperty(dst)) {

        action = stopleak[CUSTOM_SETTINGS][src][dst];

        if (!isValidAction(action)) {

            console.log('storage: invalid custom setting: ' + action);
            return ACTION_UNKNOWN;
        } else {
            return action;
        }
    }

    //check SWWL
    len = stopleak[SWWL].length;
    for (i = 0; i < len; i++) {
        if (stopleak[SWWL][i] === src) {
            return ACTION_ALLOW;
        }
    }

    //check settings map list
    if (stopleak[SETTINGS].hasOwnProperty(dst)) {
        action = stopleak[SETTINGS][dst];
        if (isValidAction(action)) {
            return action;
        } else {
            console.log('storage: got bad action - ' + action);
            return ACTION_UNKNOWN;
        }
    }

    return ACTION_UNKNOWN;
};

getUserData();
chrome.storage.onChanged.addListener(updateUserData);
