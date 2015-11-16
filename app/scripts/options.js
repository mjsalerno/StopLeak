'use strict';
/* global BLOCKED_STRINGS, ALLOW, DENY, SCRUB, SWWL*/

function addStringToUI(str, idd, key) {
    var table = document.getElementById(idd);
    var row = table.insertRow(0);
    var cell0 = row.insertCell(0);
    var cell1 = row.insertCell(1);
    cell1.innerHTML = str;

    var btn = document.createElement('button');
    btn.innerHTML = 'Delete';
    btn.type = 'button';
    btn.onclick = function() { // Note this is a function
        chrome.storage.sync.get(null, function(items) {
            var filters = items[key];
            var index = filters.indexOf(str);
            if (index > -1) {
                filters.splice(index, 1);
                var a  = {};
                a[key]=filters;
                chrome.storage.sync.set(a, function() {
                    row.parentNode.removeChild(row);
                });
            } else {
                console.log('could not remove the filter: ' + str);
            }
        });
    };
    cell0.appendChild(btn);
}

function refreshSetting(idd, key) {
    chrome.storage.sync.get(null, function(items) {
        if(!items[key]) {
            return;
        }
        var filters = items[key];
        document.getElementById(idd).innerHTML = '';
        console.log(filters);
        for (var i = 0; i < filters.length; i++) {
            addStringToUI(filters[i], idd, key);
        }
    });
}

function addSetting(inId, tblId, key) {
    var newFilter = document.getElementById(inId).value;
    if(!newFilter) {
        return;
    }
    chrome.storage.sync.get(null, function(items) {
        var filters = [];
        if (items[key]) {
            filters = items[key];
            if(filters.indexOf(newFilter) > -1) {
                return;
            }
        }
        filters.push(newFilter);
        var a  = {};
        a[key]=filters;
        chrome.storage.sync.set(a, function() {
            refreshSetting(tblId, key);
        });
    });
}

function clearFilters() {
    chrome.storage.sync.clear();
    document.getElementById('filter-tbl').innerHTML = '';
}

function clearAllows() {
    chrome.storage.sync.clear();
    document.getElementById('allow-tbl').innerHTML = '';
}

function clearDeny() {
    chrome.storage.sync.clear();
    document.getElementById('deny-tbl').innerHTML = '';
}

function clearScrub() {
    chrome.storage.sync.clear();
    document.getElementById('scrub-tbl').innerHTML = '';
}

function clearSWWL() {
    chrome.storage.sync.clear();
    document.getElementById('swwl-tbl').innerHTML = '';
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('add-filter-btn').onclick = function() {
        addSetting('new-filter', 'filter-tbl', BLOCKED_STRINGS);
    };
    document.getElementById('add-allow-btn').onclick = function() {
        addSetting('new-allow', 'allow-tbl', ALLOW);
    };
    document.getElementById('add-deny-btn').onclick = function() {
        addSetting('new-deny', 'deny-tbl', DENY);
    };
    document.getElementById('add-scrub-btn').onclick = function() {
        addSetting('new-scrub', 'scrub-tbl', SCRUB);
    };
    document.getElementById('add-swwl-btn').onclick = function() {
        addSetting('new-swwl', 'swwl-tbl', SWWL);
    };

    document.getElementById('clear-filter-btn').onclick = clearFilters;
    document.getElementById('clear-allow-btn').onclick = clearAllows;
    document.getElementById('clear-deny-btn').onclick = clearDeny;
    document.getElementById('clear-scrub-btn').onclick = clearScrub;
    document.getElementById('clear-swwl-btn').onclick = clearSWWL;
    //var filters = ['john', 'smith', 'john smith'];
    //chrome.storage.sync.set({BLOCKED_STRINGS:filters});
    refreshSetting('filter-tbl', BLOCKED_STRINGS);
    refreshSetting('allow-tbl', ALLOW);
    refreshSetting('deny-tbl', DENY);
    refreshSetting('scrub-tbl', SCRUB);
    refreshSetting('swwl-tbl', SWWL);
});
