'use strict';
/* global $, BLOCKED_STRINGS, SETTINGS, SWWL, CUSTOM_SETTINGS, ACTION_ALLOW, ACTION_DENY, ACTION_SCRUB, updateSyncSetting, delSyncStorage */

var bgPage = chrome.extension.getBackgroundPage();

function removeColumn(evt) {
    var element = $(evt.target);
    var parent = element.parent().parent();

    var rows = parent.find('td');

    var bgPage = chrome.extension.getBackgroundPage();
    bgPage.delSyncStorage(CUSTOM_SETTINGS, {
        src: $(rows[0]).html(),
        dst: $(rows[1]).html(),
        action: $(rows[2]).html()
    }, null, null);

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
function addStringToActionUI(origin, idd) {
    var table = document.getElementById(idd);
    var row = table.insertRow(0);
    //row.id = str;
    var cell0 = row.insertCell(0);
    var cell1 = row.insertCell(1);
    cell1.innerHTML = origin;

    var btn = document.createElement('button');
    btn.innerHTML = 'Delete';
    btn.type = 'button';
    btn.onclick = function() { // Note this is a function
        chrome.storage.sync.get(null, function(items) {
            var filters = items[SETTINGS];
            if (filters.hasOwnProperty(origin)) {
                delete filters[origin];
                var a  = {};
                a[SETTINGS] = filters;
                chrome.storage.sync.set(a, function() {
                    row.parentNode.removeChild(row);
                });
            } else {
                console.log('could not remove the filter: ' + origin);
            }
        });
    };
    cell0.appendChild(btn);
}

function addStringToUI(str, idd, key) {
    var table = document.getElementById(idd);
    var row = table.insertRow(0);
    row.id = str;
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

function refreshActionSetting(idd, action) {
    chrome.storage.sync.get(null, function(items) {
        if (!items[SETTINGS]) {
            return;
        }
        var filters = items[SETTINGS];
        document.getElementById(idd).innerHTML = '';
        for (var orig in filters) {
            if (filters[orig] === action) {
                addStringToActionUI(orig, idd);
            }
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

    bgPage.updateSyncSetting(key, {val: newFilter}, function() {
        refreshSetting(tblId, key);
    },  null);
}

function addActionSetting(inId, action) {
    var newOrigin = document.getElementById(inId).value;
    if (!newOrigin) {
        return;
    }

    // TODO: Tell user on failure.
    bgPage.updateSyncSetting(SETTINGS, {val: newOrigin, action: action},
        function() {
            refreshActionSetting('allow-tbl', ACTION_ALLOW);
            refreshActionSetting('deny-tbl', ACTION_DENY);
            refreshActionSetting('scrub-tbl', ACTION_SCRUB);
        },
    null);
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

function cleanActionSetting(tblid, action) {
    chrome.storage.sync.get(null, function(list) {
        if (list.hasOwnProperty(SETTINGS)) {
            var settings = list[SETTINGS];

            for (var key in settings) {
                if (settings[key] === action) {
                    delete settings[key];
                }
            }
            var a = {};
            a[SETTINGS] = settings;
            chrome.storage.sync.set(a, function() {
                document.getElementById(tblid).innerHTML = '';
            });
        }
    });
}

function clearFilters() {
    chrome.storage.sync.remove(BLOCKED_STRINGS);
    document.getElementById('filter-tbl').innerHTML = '';
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

    bgPage.updateSyncSetting(CUSTOM_SETTINGS, args, function() {
        buildTableRow(args);
    }, null);

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
        addActionSetting('new-allow',  ACTION_ALLOW);
    };
    document.getElementById('add-deny-btn').onclick = function() {
        addActionSetting('new-deny',  ACTION_DENY);
    };
    document.getElementById('add-scrub-btn').onclick = function() {
        addActionSetting('new-scrub', ACTION_SCRUB);
    };
    document.getElementById('add-swwl-btn').onclick = function() {
        addSetting('new-swwl', 'swwl-tbl', SWWL);
    };
    // document.getElementById('add-cs-btn').onclick = addCustSetting;
    document.getElementById('add-cs-btn').onclick = addCustomSetting;
    document.getElementById('clear-filter-btn').onclick = clearFilters;

    document.getElementById('clear-allow-btn').onclick = function() {
        cleanActionSetting('allow-tbl', ACTION_ALLOW);
    };
    document.getElementById('clear-deny-btn').onclick = function() {
        cleanActionSetting('deny-tbl', ACTION_DENY);
    };
    document.getElementById('clear-scrub-btn').onclick = function() {
        cleanActionSetting('scrub-tbl', ACTION_SCRUB);
    };

    document.getElementById('clear-swwl-btn').onclick = clearSWWL;
    document.getElementById('clear-cs-btn').onclick = clearCustSettings;

    refreshSetting('filter-tbl', BLOCKED_STRINGS);
    refreshActionSetting('allow-tbl', ACTION_ALLOW);
    refreshActionSetting('deny-tbl', ACTION_DENY);
    refreshActionSetting('scrub-tbl', ACTION_SCRUB);
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
