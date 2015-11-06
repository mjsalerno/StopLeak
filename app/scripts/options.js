'use strict';

console.log('\'Allo \'Allo! Option');
var STORAGE_KEY = 'filter';

function addStringToUI(str) {
    var table = document.getElementById("settings-tbl");
    var row = table.insertRow(0);
    row.id = str;
    var cell0 = row.insertCell(0);
    var cell1 = row.insertCell(1);
    cell1.innerHTML = str;
    //var element = document.createElement("input");

    var btn = document.createElement("button");
    btn.innerHTML = 'Delete';
    btn.type = 'button';
    btn.onclick = function() { // Note this is a function
        console.log('dont\' delete me!!!');
        chrome.storage.sync.get(null, function(items) {
            var filters = items[STORAGE_KEY];
            var index = filters.indexOf(str);
            if (index > -1) {
                filters.splice(index, 1);
                var a  = {};
                a[STORAGE_KEY]=filters;
                chrome.storage.sync.set(a, function() {
                    refreshFilters();
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
        if(!items[STORAGE_KEY]) return;
        var filters = items[STORAGE_KEY];
        document.getElementById("settings-tbl").innerHTML = "";
        console.log(filters);
        for (var i = 0; i < filters.length; i++) {
            addStringToUI(filters[i]);
        }
    });
}

function addFilter() {
    var newFilter = document.getElementById("new-filter").value;
    if(!newFilter) return;
    chrome.storage.sync.get(null, function(items) {
        var filters = [];
        if (items[STORAGE_KEY]) {
            filters = items[STORAGE_KEY];
            if(filters.indexOf(newFilter) > -1) return;
        }
        filters.push(newFilter);
        var a  = {};
        a[STORAGE_KEY]=filters;
        chrome.storage.sync.set(a, function() {
            refreshFilters();
        });
    });
}

function clearFilters() {
    chrome.storage.sync.clear();
    document.getElementById("settings-tbl").innerHTML = "";
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById("add-filter-btn").onclick = addFilter;
    document.getElementById("clear-filter-btn").onclick = clearFilters;
    //var filters = ['john', 'smith', 'john smith'];
    //chrome.storage.sync.set({STORAGE_KEY:filters});
    refreshFilters();
});
