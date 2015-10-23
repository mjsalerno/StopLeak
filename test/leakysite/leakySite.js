/*global $*/
var defaultUrl = 'https://mjsalerno.github.io';
var defaultData = 'scott, shane, michael, mike, paul';

function showResults(response) {
    $('#results').html(response);
}

function leakFailed(xhr) {
    if (xhr.responseText) {
        showResults(xhr.responseText);
    }
    else {
        showResults('Probably ERR_BLOCKED_BY_CLIENT (meaning StopLeak!)');
        console.log(xhr);
    }
}

function leakData(method) {
    var url = $('#leaky-url').val();
    var data = $('#leaky-text').val();

    if (!url) {
        url = defaultUrl;
    }

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

    req.done(showResults);
    req.fail(leakFailed);
}

function leakByGet() {
    leakData('GET');
}

function leakByPost() {
    leakData('POST');
}

function addHandlers() {
    $('#leaky-get-button').bind('click', leakByGet);
    $('#leaky-post-button').bind('click', leakByPost);
    $('#leaky-url').text(defaultUrl);
    $('#leaky-text').attr('placeholder', defaultData);
}

$(document).ready(addHandlers);
