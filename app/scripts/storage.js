/**
 * Created by michael on 11/15/15.
 */
/* global BLOCKED_STRINGS,  ALLOW, DENY, SCRUB*/
/*exported getUserData*/
'use strict';

var stopleak = stopleak || {};

stopleak.PIIData = stopleak.PIIData || [];
stopleak.deny = stopleak.deny || [];
stopleak.allow = stopleak.allow || [];
stopleak.scrub = stopleak.scrub || [];

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
