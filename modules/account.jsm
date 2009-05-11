/*
 * Copyright 2009 by POTI Inc.
 *
 * This file is part of Murmuration.
 *
 * Murmuration is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 3 of the License, or (at your
 * option) any later version.
 *
 * Murmuration is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// Account Manager.  Responsible for maintaining the current
// account, and syncronizing with the web site.  

// TODO: Needs to be completely rewritten in a less braindead way.
// TODO: JSMs loaded by JSMs is a bad idea, since error messages 
// get lost somehow. When rewriting this, think about using
// the jsloader like SamePlace.


// EXPORTS
// ----------------------------------------------------------------------

var EXPORTED_SYMBOLS = ['account'];

// DEFINITIONS
// ----------------------------------------------------------------------

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cctor = Components.Constructor
var srvObserver = Cc['@mozilla.org/observer-service;1']
    .getService(Ci.nsIObserverService);
var prefServices = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.murmuration.');

var loginMgr = Cc["@mozilla.org/login-manager;1"]
                 .getService(Ci.nsILoginManager);

var nsLoginInfo = new Cctor("@mozilla.org/login-manager/loginInfo;1",
                            Ci.nsILoginInfo,
                            "init");


Cu.import('resource://xmpp4moz/xmpp.jsm');

const SERVER = "skunk.grommit.com";
const RESOURCE = "SongbirdMurmuration"
const PORT = 5222;

var account = {

  // STATE
  // ----------------------------------------------------------------------
  _channel: null,
  _listeners: [],
  _loginInfo: null,
  _friends: [],
  
  // INITIALIZATION
  // ----------------------------------------------------------------------

  init: function() {
    // find saved logins
    var logins = loginMgr.findLogins({},
                                     "xmpp://" + SERVER,
                                     null,
                                     "xmpp://" + SERVER);
    if (logins.length) {
      // XXX Mook: assume one login for now
      this._loginInfo = logins[0];
    } else {
      this._loginInfo = new nsLoginInfo("xmpp://" + SERVER,
                                        null,
                                        "xmpp://" + SERVER,
                                        null,
                                        null,
                                        "",
                                        "");
    }
    
    this._channel = XMPP.createChannel();
    
    // XXX Megahack TODO.  To get things up and running the server
    // passes the account info via a cookie.  This is an extremely
    // bad idea.  Make sure this is fixed before any public release.
    var observerService = Cc["@mozilla.org/observer-service;1"]
                            .getService(Ci.nsIObserverService);
    observerService.addObserver(this, "cookie-changed", false);

    this._loadFriends();
  }, 

  finish: function() {
    delete this._listeners;
    var observerService = Cc["@mozilla.org/observer-service;1"]
                            .getService(Ci.nsIObserverService);
    observerService.removeObserver(this, "cookie-changed");
  },

  // METHODS
  // ----------------------------------------------------------------------
  
  get jid() {
    var address = this.address;
    return (address) ? address + "/" + RESOURCE : null;
  },
  
  get address() {
    if (this.isConfigured) {
      return this._loginInfo.username +
             "@" +
             this._loginInfo.hostname.replace(/^xmpp:\/\//, '');
    }
    return null;
  },
  
  get userName() {
    return this._loginInfo.username;
  },
  
  get password() {
    return this._loginInfo.password;
  },
  
  set userName(value) {
    // this is kinda ridiculous
    var newLogin = new nsLoginInfo(this._loginInfo.hostname,
                                   this._loginInfo.formSubmitURL,
                                   this._loginInfo.httpRealm,
                                   value,
                                   this._loginInfo.password,
                                   this._loginInfo.usernameField,
                                   this._loginInfo.passwordField);
    if (this.isConfigured) {
      loginMgr.modifyLogin(this._loginInfo, newLogin);
    } else {
      if (newLogin.username !== null && newLogin.password !== null) {
        loginMgr.addLogin(newLogin);
      }
    }
    this._loginInfo = newLogin;
    return this._loginInfo.username;
  },

  set password(value) {
    // this is kinda ridiculous
    var newLogin = new nsLoginInfo(this._loginInfo.hostname,
                                   this._loginInfo.formSubmitURL,
                                   this._loginInfo.httpRealm,
                                   this._loginInfo.username,
                                   value,
                                   this._loginInfo.usernameField,
                                   this._loginInfo.passwordField);
    if (this.isConfigured) {
      loginMgr.modifyLogin(this._loginInfo, newLogin);
    } else {
      if (newLogin.username !== null && newLogin.password !== null) {
        loginMgr.addLogin(newLogin);
      }
    }
    this._loginInfo = newLogin;
    return this._loginInfo.password;
  },

  get isConfigured() {
    // force to bool, don't accidentally leak the password
    return !!(this.userName && this.password);
  },

  get friends() {
    return this._friends;
  },

  _loadFriends: function() {
    var username = this.userName;
    var password = this.password;
    var url = "http://" + SERVER + "/api/friends/nicks/" +username+ ".json";
    var self = this;
    var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function() {
      if (this.readyState != 4)
        return;
      if (this.status == 200) {
        var nativeJSON = Cc["@mozilla.org/dom/json;1"]
                          .createInstance(Ci.nsIJSON);
        self._friends = new Array();
        for each (var friend in nativeJSON.decode(this.responseText)) {
            self._friends[friend.screen_name] = friend;
        }
      }
    }
    xhr.send(null);
  },

  addListener: function(listener) {
    this._listeners.push(listener);
  },

  removeListener: function(listener) {
    var index = this._listeners.indexOf(listener);
    if (index >= 0) {
      this._listeners.splice(index, 1); 
    } 
    else {
      throw("Listener not found"); 
    }
  },

  notifyListeners: function() {
    for each (var listener in this._listeners) {
      try {
        listener.onAccountChange();
      } catch (e) {
        Cu.reportError(e);
      }
    }
  },
  
  /**
   * Trap a murmuration account cookie being set.
   * This is a bad idea, but there is no other security in 
   * this prototype, so it doesn't much matter.
   */
  observe: function(subject, topic, data) {
    if (topic == "cookie-changed" && (data == "added" || data == "changed")) {
      var cookie = subject.QueryInterface(Components.interfaces.nsICookie);
      if (cookie.host == ("." + SERVER) && cookie.name == "murmurationaccount") {

        if (this.jid && XMPP.isUp(this.jid)) {
          XMPP.down(this.jid);
        }
        
        var parts = /^account=(.*);pass=(.*)$/.exec(unescape(cookie.value));
        this.userName = parts[1];
        this.password = parts[2];
        
        if (this.isConfigured) {
          // Hack: force this account into the XMPP settings
          var pref = Cc['@mozilla.org/preferences-service;1']
                       .getService(Ci.nsIPrefService)
                       .getBranch('xmpp.account.');

          // Check to see if we already have an account registered so we
          // don't create multiple xmpp accounts for the same account
          var existing = false;
          var self = this;
          XMPP.accounts.forEach(function(a) {
            var aJid = pref.getCharPref(a.key + '.address') + "/" +
                pref.getCharPref(a.key + '.resource');
            dump("checking " + aJid + " against" + self.jid + "\n");
            if (aJid == self.jid) {
              existing = true;
            }
          });
          if (existing) {
            dump("ACCOUNT ALREADY EXISTS\n");
            return;
          }
          dump("Connecting account " + uneval(account) + "\n\n");

          var account = {
            jid: this.jid,
            resource: RESOURCE,
            address: this.address,
            password: this.password,
            connectionPort: PORT,
            connectionSecurity: 0,
            connectionHost: SERVER,
          };
          
          var key = (new Date()).getTime();
          pref.setCharPref(key + '.address', account.address);
          pref.setCharPref(key + '.resource', account.resource);
          if(account.password)
            XMPP.setPassword(account.address, account.password);
          pref.setCharPref(key + '.connectionHost', account.connectionHost);
          //pref.setCharPref(key + '.presenceHistory', '[]');
          pref.setIntPref(key + '.connectionPort', account.connectionPort);
          pref.setIntPref(key + '.connectionSecurity', account.connectionSecurity);
          
          // TODO Error handling, etc.
          // XXX Assumes only one account.
          XMPP.up(XMPP.accounts.get(0));
        }
        
        this.notifyListeners();
      }
    }
  }
}

