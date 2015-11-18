'use strict';

var stopleak = stopleak || {};

/**
 * Return the origin from a url.
 *
 * @param {string} url Any url.
 */
stopleak.extractOrigin = function(url) {
    return new URL(url).origin;
};

/**
 * Return the value of the headerName in the provided request.
 *
 * @param {object} header Chrome's HTTPHeader object.
 * @returns {*} Returns the value or binaryValue of the header.
 */
stopleak.getHeaderValue = function(header) {
    if (header.hasOwnProperty('value')) {
        return header.value;
    } else if (header.hasOwnProperty('binaryValue')) {
        return header.binaryValue;
    }
    return '';
};

/**
 * Return the value of the headerName in the provided request.
 *
 * @param {array} requestHeaders Array of HTTPHeader objects
 * @param {string} headerName
 * @returns {*} value or binaryValue of the header in the request, or null if
 *     the request is not present.
 */
stopleak.requestGetHeader = function(requestHeaders, headerName) {
    if (requestHeaders instanceof Array) {
        for (var j = 0; j < requestHeaders.length; ++j) {
            var header = requestHeaders[j];
            if (header.name === headerName) {
                return stopleak.getHeaderValue(header);
            }
        }
    }
    return null;
};

/**
 * Returns a string encoding of the ArrayBuffer
 *
 * @param {ArrayBuffer} buf ArrayBuffer
 * @return {String} string encoding of buf
 */
stopleak.arrayToString = function(buf) {
    return new TextDecoder().decode(new Uint8Array(buf));
};
