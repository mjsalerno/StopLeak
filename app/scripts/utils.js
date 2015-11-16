'use strict';

var stopleak = stopleak || {};

/**
 * Return the domain name from a url.
 * @param {string} url Any url.
 */
stopleak.getDomain = function (url) {
    var host = new URL(url).hostname;

    return host.split('.').slice(-2).join('.');
};
