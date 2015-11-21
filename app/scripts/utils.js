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
 * Return the value of the requestBody in the provided request.
 *
 * @param {object} request Request
 * @returns {object} maps keys to array of values. An example value
 *    of this dictionary is {'key': ['value1', 'value2']}.
 */
stopleak.getRequestBody = function(request) {
    if (!request.hasOwnProperty('requestBody')) {
        return {};
    }
    var requestBody = request.requestBody;
    var body = {};
    if (requestBody.hasOwnProperty('formData')) {
        body = requestBody.formData;
    } else if (requestBody.hasOwnProperty('raw')) {
        // If the request method is PUT or POST, and the body is not already
        // parsed in formData, then the unparsed request body elements are
        // contained in this array. Each entry in the array is of UploadData
        // type which has a 'bytes' or 'file' attribute.
        for (var i = 0; i < requestBody.raw.length; ++i) {
            var uploadData = requestBody.raw[i];
            if (uploadData.hasOwnProperty('bytes')) {
                body.bytes = body.bytes || [];
                body.bytes.push(stopleak.arrayToString(uploadData.bytes));
            }
            if (uploadData.hasOwnProperty('file')) {
                body.file = body.file || [];
                body.file.push(uploadData.file);
            }
        }
    }
    return body;
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

/**
 * Returns a random integer between min (included) and max (included)
 *
 * @param {number} min
 * @param {number} max
 * @returns {number} Random number in range (min, max)
 */
stopleak.getRandomIntInclusive = function(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Returns a pseudo random string of length len.
 *
 * @param {number} len Length of the random string to generate (max 1099).
 * @return {String} pseudo random string of len characters.
 */
stopleak.getPseudoRandomString = function(len) {
    return (Math.random() * Math.random()).toString(31).slice(-len);
};

/**
 * Escape regex special characters.
 *
 * @param str Input string.
 * @returns {string} Properly escaped string for regex.
 */
stopleak.escapeRegExp = function(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
