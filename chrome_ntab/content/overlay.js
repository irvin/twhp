/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  var ns = MOA.ns('NTab');

  var _url = 'about:ntab';
  Cu.import('resource://ntab/quickdial.jsm');

  function loadInExistingTabs() {
    if (!Services.prefs.getBoolPref("moa.ntab.loadInExistingTabs")) {
      return;
    }

    if (!Services.prefs.getBoolPref('moa.ntab.openInNewTab')) {
      return;
    }

    var chromehidden = document.getElementById('main-window').getAttribute('chromehidden');
    if (chromehidden.match(/menubar/))
      return;

    var tabs = gBrowser.tabContainer.childNodes;
    for (var i = 0; i < tabs.length; i++) {
      var tab = tabs[i];
      if (!tab.hasAttribute('busy') && !tab.hasAttribute('isPermaTab')) {
        var doc = tab.linkedBrowser.contentDocument;
        if (doc && doc.location == 'about:blank') {
          doc.location = _url;
          tab.linkedBrowser.userTypedValue = '';
        }
      }
    }
  }

  function showLastNotification() {
    let shown = false;
    try {
      shown = Services.prefs.getBoolPref('moa.ntab.lastNotificationShown');
    } catch (e) {}
    if (shown) return;

    let nb = document.getElementById('global-notificationbox');
    let notification = nb.appendNotification(
      'Mozilla Taiwan \u5c07\u5f9e Firefox 34 \u958b\u59cb\u63d0\u4f9b\u7531\u793e\u7fa4\u7dad\u8b77\u7684\u6b63\u9ad4\u4e2d\u6587\u5168\u7403\u7248\u3002\u539f\u53f0\u7063\u5206\u516c\u53f8\u5ba2\u88fd\u7248\u76f8\u95dc\u64f4\u5145\u5957\u4ef6\u50c5\u652f\u63f4\u5230 Firefox 34\uff0c\u5176\u9918\u64f4\u5145\u5957\u4ef6\u5247\u6703\u7e7c\u7e8c\u7dad\u8b77\u4e0d\u53d7\u5f71\u97ff\u3002 \u8acb\u7e7c\u7e8c\u611b\u7528Firefox\u700f\u89bd\u5668\u3002',
      'twhp-last-notification',
      null,
      nb.PRIORITY_INFO_HIGH,
      null
    );

    Services.prefs.setBoolPref('moa.ntab.lastNotificationShown', true);
  }

  var newTabPref = {
    _appPreloadKey: 'browser.newtab.preload',
    _appUrlKey: 'browser.newtab.url',
    extPrefKey: 'moa.ntab.openInNewTab',

    inUse: true,

    _observer: {
      QueryInterface: function(aIID) {
        if (aIID.equals(Ci.nsIObserver) ||
            aIID.equals(Ci.nsISupports) ||
            aIID.equals(Ci.nsISupportsWeakReference)) {
            return this;
        }
        throw Cr.NS_NOINTERFACE;
      },

      observe: function(aSubject, aTopic, aData) {
        if (aTopic == 'nsPref:changed') {
          switch (aData) {
            case newTabPref.extPrefKey:
              newTabPref.refresh();
              break;
          }
        }
      }
    },

    init: function() {
      Services.prefs.addObserver(this.extPrefKey, this._observer, true);
      this.refresh();

      gInitialPages.push(_url);
    },

    refresh: function() {
      this.inUse = Services.prefs.getBoolPref(this.extPrefKey);
      if (this.inUse) {
        Services.prefs.clearUserPref(this._appPreloadKey);
        Services.prefs.clearUserPref(this._appUrlKey);
      } else {
        Services.prefs.setCharPref(this._appUrlKey, 'about:newtab');
      }
    }
  };

  ns.browserOpenTab = function(event) {
    if (newTabPref.inUse) {
      openUILinkIn(_url, 'tab');

      // for Fx 12 and older versions
      focusAndSelectUrlBar();
    } else {
      window.originalBrowserOpenTab(event);
    }
  };

  ns.onLoad = function() {
    // load ntab page in existing empty tabs.
    // Under Firefox5, this function will open "about:ntab" in the blank page in which
    // the welcome page is opened.
    // So set an timeout to run this function, make sure welcome page will be opened.
    setTimeout(function() {
      loadInExistingTabs();
    }, 1000);

    // Catch new tab
    if (window.TMP_BrowserOpenTab) {
      gBrowser.removeEventListener('NewTab', window.TMP_BrowserOpenTab, true);
      gBrowser.removeEventListener('NewTab', window.BrowserOpenTab, true);
      window.originalBrowserOpenTab = window.TMP_BrowserOpenTab;
      window.BrowserOpenTab = window.TMP_BrowserOpenTab = MOA.NTab.browserOpenTab;
      gBrowser.addEventListener('NewTab', window.BrowserOpenTab, true);
    } else if (window.TBP_BrowserOpenTab) {
      gBrowser.removeEventListener('NewTab', window.TBP_BrowserOpenTab, true);
      window.originalBrowserOpenTab = window.TBP_BrowserOpenTab;
      window.TBP_BrowserOpenTab = MOA.NTab.browserOpenTab;
      gBrowser.addEventListener('NewTab', window.TBP_BrowserOpenTab, true);
    } else {
      gBrowser.removeEventListener('NewTab', window.BrowserOpenTab, false);
      window.originalBrowserOpenTab = window.BrowserOpenTab;
      window.BrowserOpenTab = MOA.NTab.browserOpenTab;
      gBrowser.addEventListener('NewTab', window.BrowserOpenTab, false);
    }

    newTabPref.init();

    showLastNotification();
  };

  ns.onMenuItemCommand = function(event) {
    if (event.target.tagName != 'menuitem')
      return;
    var url, title;
    url = gContextMenu.linkURL;
    if (url) {
      title = gContextMenu.linkText();
    } else {
      url = window._content.document.location.href;
      title = window._content.document.title;
    }

    var stringBundle = document.getElementById('ntab-strings');

    if (!isValidUrl(url)) {
      Services.prompt.alert(null,
        stringBundle.getString('ntab.contextmenu.title'),
        stringBundle.getString('ntab.contextmenu.invalidurl'));
      return;
    }

    var index = quickDialModule.fillBlankDial({
      title: title,
      url: url
    });

    if (index > 0) {
      Services.prompt.alert(null,
        stringBundle.getString('ntab.contextmenu.title'),
        stringBundle.getFormattedString('ntab.contextmenu.addedtodial', [index]));
    } else {
      Services.prompt.alert(null,
        stringBundle.getString('ntab.contextmenu.title'),
        stringBundle.getString('ntab.contextmenu.noblankdial'));
    }
  };

  var isValidUrl = function (aUrl) {
    // valid urls don't contain spaces ' '; if we have a space it isn't a valid url.
    // Also disallow dropping javascript: or data: urls--bail out
    if (!aUrl || !aUrl.length || aUrl.indexOf(" ", 0) != -1 ||
       /^\s*(javascript|data|chrome):/.test(aUrl))
    return false;

    return true;
  };

  function getDialNum(elem) {
    var num = -1;
    while (!(elem instanceof HTMLBodyElement)) {
        if (elem.hasAttribute('data-index') &&
            parseInt(elem.getAttribute('data-index'), 10) > -1 &&
            elem.getAttribute('draggable') == 'true') {
        num = parseInt(elem.getAttribute('data-index'), 10);
        break;
      }

      elem = elem.parentNode;
    }

    return num;
  }

  var _num = -1;
  ns.onContextCommand = function(event, menuid) {
    switch (menuid) {
      case 'nt-refresh':
        content.wrappedJSObject.Grid.refreshGridItem(_num);
        break;
      case 'nt-refreshall':
        content.wrappedJSObject.Grid.refreshAll();
        break;
      case 'nt-edit':
        content.wrappedJSObject.Grid.editGridItem(_num);
        break;
      case 'nt-export':
        content.wrappedJSObject.DataBackup.exportToFile();
        break;
      case 'nt-import':
        content.wrappedJSObject.DataBackup.importFromFile();
        break;
    }
  };

  ns.onContextMenu = function(event) {
    _num = getDialNum(event.target);

    document.getElementById('nt-refresh').hidden = _num < 0;
    document.getElementById('nt-edit').hidden = _num < 0;
    document.getElementById('nt-refreshall').hidden = Services.prefs.getCharPref('moa.ntab.view') !== 'quickdial';

    document.getElementById('nt-menu').openPopupAtScreen(event.screenX, event.screenY, true);
    event.preventDefault();
    event.stopPropagation();
  };

  ns.onKeydown = function(evt) {
    //var selectedDocument = gBrowser.selectedBrowser.contentDocument;
    if (//selectedDocument.URL == _url &&
      Services.prefs.getBoolPref('moa.ntab.display.usehotkey') &&
      evt.ctrlKey && 48 < evt.keyCode && evt.keyCode <= 57) {
      evt.preventDefault();
      evt.stopPropagation();
      var index = evt.keyCode - 48 || 10;
      /*var selector = ['li[data-index="', index, '"] > a'].join('');
      var anchor = selectedDocument.querySelector(selector);
      if (anchor) {
        var clickEvt = selectedDocument.createEvent("MouseEvents");
        clickEvt.initMouseEvent("click", true, true,
          selectedDocument.defaultView,
          0, 0, 0, 0, 0, false, false, false, false, 0, null);
        anchor.dispatchEvent(clickEvt);
      }*/
      var dial = quickDialModule.getDial(index);
      if(dial && dial.url) {
        openUILinkIn(dial.url, 'tab');
      }
    }
  };

  ns.onContextMenuGlobal = function() {
    document.getElementById('context-ntab').hidden = !Services.prefs.getBoolPref('moa.ntab.contextMenuItem.show') || window._content.document.location.href == _url;
  };
})();

window.addEventListener("load", function() {
  window.setTimeout(function() {
    MOA.NTab.onLoad();
    gBrowser.addEventListener("contextmenu", MOA.NTab.onContextMenuGlobal, false);
    window.addEventListener("keydown", MOA.NTab.onKeydown, true);
  }, 1);
}, false);
