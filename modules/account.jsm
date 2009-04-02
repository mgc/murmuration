// XXX TODO license.

// Account Manager.  
// TODO Rewrite

// EXPORTS
// ----------------------------------------------------------------------

var EXPORTED_SYMBOLS = ['account'];


// DEFINITIONS
// ----------------------------------------------------------------------

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var srvObserver = Cc['@mozilla.org/observer-service;1']
    .getService(Ci.nsIObserverService);
var prefServices = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.murmuration.');

Cu.import('resource://xmpp4moz/xmpp.jsm');

var account = {

  // STATE
  // ----------------------------------------------------------------------
  _channel: null,
  _listeners: [],
  
  // INITIALIZATION
  // ----------------------------------------------------------------------

  init: function() {
    this._channel = XMPP.createChannel();
    
    // XXX Megahack TODO.  To get things up and running the server
    // passes the account info via a cookie.  This is an extremely
    // bad idea.  Make sure this is fixed before any public release.
    var observerService = Cc["@mozilla.org/observer-service;1"]
                            .getService(Ci.nsIObserverService);
    observerService.addObserver(this, "cookie-changed", false);    
  }, 

  finish: function() {
    delete this._listeners;
    var observerService = Cc["@mozilla.org/observer-service;1"]
                            .getService(Ci.nsIObserverService);
    observerService.removeObserver(this, "cookie-changed");
  },

  // METHODS
  // ----------------------------------------------------------------------
  get userName() {
    return prefServices.getCharPref("username");
  },
  
  get password() {
    return prefServices.getCharPref("password");    
  },
  
  set userName(value) {
    return prefServices.setCharPref("username", value);
  },

  set password(value) {
    return prefServices.setCharPref("password", value);
  },

  get isConfigured() {
    return this.userName && this.password;
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
      if (cookie.host == ".skunk.grommit.com" && cookie.name == "murmurationaccount") {
        var parts = /^account=(.*);pass=(.*)$/.exec(unescape(cookie.value));
        this.userName = parts[1];
        this.password = parts[2];
        this.notifyListeners();
      }
    }
  }
}
