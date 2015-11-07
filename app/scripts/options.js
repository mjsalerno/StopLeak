'use strict';
/* global BLOCKED_STRINGS */

console.log('\'Allo \'Allo! Option');

function addStringToUI(str) {
    var table = document.getElementById('settings-tbl');
    var row = table.insertRow(0);
    row.id = str;
    var cell0 = row.insertCell(0);
    var cell1 = row.insertCell(1);
    cell1.innerHTML = str;
    //var element = document.createElement("input");

    var btn = document.createElement('button');
    btn.innerHTML = 'Delete';
    btn.type = 'button';
    btn.onclick = function() { // Note this is a function
        chrome.storage.sync.get(null, function(items) {
            var filters = items[BLOCKED_STRINGS];
            var index = filters.indexOf(str);
            if (index > -1) {
                filters.splice(index, 1);
                var a  = {};
                a[BLOCKED_STRINGS]=filters;
                chrome.storage.sync.set(a, function() {
                    var element = document.getElementById(str);
                    element.parentNode.removeChild(element);
                });
            } else {
                console.log('could not remove the filter: ' + str);
            }
        });
    };
    cell0.appendChild(btn);
}

function refreshFilters() {
    chrome.storage.sync.get(null, function(items) {
        if(!items[BLOCKED_STRINGS]) {
            return;
        }
        var filters = items[BLOCKED_STRINGS];
        document.getElementById('settings-tbl').innerHTML = '';
        console.log(filters);
        for (var i = 0; i < filters.length; i++) {
            addStringToUI(filters[i]);
        }
    });
}

function addFilter() {
    var newFilter = document.getElementById('new-filter').value;
    if(!newFilter) {
        return;
    }
    chrome.storage.sync.get(null, function(items) {
        var filters = [];
        if (items[BLOCKED_STRINGS]) {
            filters = items[BLOCKED_STRINGS];
            if(filters.indexOf(newFilter) > -1) {
                return;
            }
        }
        filters.push(newFilter);
        var a  = {};
        a[BLOCKED_STRINGS]=filters;
        chrome.storage.sync.set(a, function() {
            refreshFilters();
        });
    });
}

function clearFilters() {
    chrome.storage.sync.clear();
    document.getElementById('settings-tbl').innerHTML = '';
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('add-filter-btn').onclick = addFilter;
    document.getElementById('clear-filter-btn').onclick = clearFilters;
    //var filters = ['john', 'smith', 'john smith'];
    //chrome.storage.sync.set({BLOCKED_STRINGS:filters});
    refreshFilters();
});
