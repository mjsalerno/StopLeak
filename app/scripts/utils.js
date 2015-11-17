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

/**
 * Return the value of the headerName in the provided request.
 * @param {array} requestHeaders Array of HTTPHeader objects
 * @param {string} headerName
 * @returns {any} Returns the value or binaryValue of the header in the
 *     request, or null if he request is not present
 */
stopleak.requestGetHeader = function (requestHeaders, headerName) {
    if (requestHeaders instanceof Array) {
        for (var j = 0; j < requestHeaders.length; ++j) {
            var header = requestHeaders[j];
            if (header.name === headerName) {
                if (header.hasOwnProperty('value')) {
                    return header.value;
                } else if (header.hasOwnProperty('binaryValue')) {
                    return header.binaryValue;
                }
            }
        }
    }
    return null;
};
