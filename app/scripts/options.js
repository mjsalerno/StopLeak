'use strict';
/* global $, BLOCKED_STRINGS, ALLOW, DENY, SCRUB, SWWL, CUSTOM_SETTINGS, ACTION_ALLOW, ACTION_DENY, ACTION_SCRUB, updateSyncSetting, delSyncStorage */

function removeColumn(evt) {
    var element = $(evt.target);
    var parent = element.parent().parent();

    var rows = parent.find('td');

    delSyncStorage(CUSTOM_SETTINGS, {
        src: $(rows[0]).html(),
        dst: $(rows[1]).html(),
        action: $(rows[2]).html()
    }, null);

    parent.fadeOut(400, function() {
        // Remove the item from the actual page.
        parent.parent().remove(parent);
    });
}

function buildTableRow(args) {
    var customSettings = $('#custom_input');
    var values = [args.src, args.dst, args.action];
    // Build a new table row
    var row = $('<tr>');
    for (var value in values) {
        var col = $('<td>', {
            class: 'box',
            html: values[value]
        });
        // Add the column to the row
        row.append(col);
    }
    // Add the remove buttons
    var rmvCol = $('<td>', {
        class: 'box',
        css: {
            'text-align': 'center'
        }
    });
    var removeIcon = $('<i>', {
        class: 'fa fa-times remove',
        title: 'remove'
    });
    // Attach the onclick action
    removeIcon.click(removeColumn);
    // Add icons to columns
    rmvCol.append(removeIcon);
    // Add edit and remove buttons
    row.append(rmvCol);
    // Add the new row to the table
    customSettings.before(row);
}

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
                a[key] = filters;
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

/*
function addStringToCS(src, dst, action) {
    var table = document.getElementById('cs-tbl');
    var row = table.insertRow(0);
    var cell0 = row.insertCell(0);
    var cell1 = row.insertCell(1);
    var cell2 = row.insertCell(2);
    cell0.innerHTML = src;
    cell1.innerHTML = dst;
    cell2.innerHTML = action;
}
*/

function refreshSetting(idd, key) {
    chrome.storage.sync.get(null, function(items) {
        if (!items[key]) {
            return;
        }
        var filters = items[key];
        document.getElementById(idd).innerHTML = '';
        for (var i = 0; i < filters.length; i++) {
            addStringToUI(filters[i], idd, key);
        }
    });
}

function refreshCustSettings() {
    chrome.storage.sync.get(null, function(items) {
        if (!items[CUSTOM_SETTINGS]) {
            return;
        }
        var maps = items[CUSTOM_SETTINGS];
        // Iterate through the map and repopulate the custom settings
        for (var src in maps) {
            var rule = maps[src];
            for (var dst in rule) {
                buildTableRow({
                    src: src,
                    dst: dst,
                    action: rule[dst]
                });
            }
        }
    });
}

function addSetting(inId, tblId, key) {
    var newFilter = document.getElementById(inId).value;
    if (!newFilter) {
        return;
    }
    chrome.storage.sync.get(null, function(items) {
        var filters = [];
        if (items[key]) {
            filters = items[key];
            if (filters.indexOf(newFilter) > -1) {
                return;
            }
        }
        filters.push(newFilter);
        var a  = {};
        a[key] = filters;
        chrome.storage.sync.set(a, function() {
            refreshSetting(tblId, key);
        });
    });
}

function addActions() {
    var x = document.getElementById('select-action');

    var option = document.createElement('option');
    option.text = ACTION_ALLOW;
    x.add(option);

    option = document.createElement('option');
    option.text = ACTION_DENY;
    x.add(option);

    option = document.createElement('option');
    option.text = ACTION_SCRUB;
    x.add(option);
}

function clearFilters() {
    chrome.storage.sync.remove(BLOCKED_STRINGS);
    document.getElementById('filter-tbl').innerHTML = '';
}

function clearAllows() {
    chrome.storage.sync.remove(ALLOW);
    document.getElementById('allow-tbl').innerHTML = '';
}

function clearDeny() {
    chrome.storage.sync.remove(DENY);
    document.getElementById('deny-tbl').innerHTML = '';
}

function clearScrub() {
    chrome.storage.sync.remove(SCRUB);
    document.getElementById('scrub-tbl').innerHTML = '';
}

function clearSWWL() {
    chrome.storage.sync.remove(SWWL);
    document.getElementById('swwl-tbl').innerHTML = '';
}

function clearCustSettings() {
    chrome.storage.sync.remove(CUSTOM_SETTINGS);
    var header = $('.header');
    var ipt = $('#custom_input');
    var custom = $('#custom_settings');
    // Empty everything and re-add it
    custom.empty();
    custom.append(header);
    custom.append(ipt);
}

function addCustomSetting() {
    var src = $('#new-cs-src');
    var dst = $('#new-cs-dst');
    var action = $('#select-action');
    if (!src.val() || !dst.val() || !action.val()) {
        // One of the values wasn't set so return
        return;
    }
    // Build an args map
    var args = {
        src: src.val(),
        dst: dst.val(),
        action: action.val()
    };

    updateSyncSetting(CUSTOM_SETTINGS, args, buildTableRow, args);

    // Add the row to the table
    // buildTableRow(src.val(), dst.val(), action.val());
    // Clear the input
    src.val('');
    dst.val('');
    action[0].selectedIndex = 0;
}

document.addEventListener('DOMContentLoaded', function() {
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
    // document.getElementById('add-cs-btn').onclick = addCustSetting;
    document.getElementById('add-cs-btn').onclick = addCustomSetting;
    document.getElementById('clear-filter-btn').onclick = clearFilters;
    document.getElementById('clear-allow-btn').onclick = clearAllows;
    document.getElementById('clear-deny-btn').onclick = clearDeny;
    document.getElementById('clear-scrub-btn').onclick = clearScrub;
    document.getElementById('clear-swwl-btn').onclick = clearSWWL;
    document.getElementById('clear-cs-btn').onclick = clearCustSettings;
    //var filters = ['john', 'smith', 'john smith'];
    //chrome.storage.sync.set({BLOCKED_STRINGS:filters});
    refreshSetting('filter-tbl', BLOCKED_STRINGS);
    refreshSetting('allow-tbl', ALLOW);
    refreshSetting('deny-tbl', DENY);
    refreshSetting('scrub-tbl', SCRUB);
    refreshSetting('swwl-tbl', SWWL);
    refreshCustSettings();

    addActions();
});

$(document).keypress(function(e) {
    if (e.which === 13) {
        if ($('#new-cs-src').is(':focus') || $('#new-cs-dst').is(':focus')) {
            $('#add-cs-btn').click();
        }
    }
});
