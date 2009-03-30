// Loaded in to the main Songbird window.  Does nothing at the moment.
// TODO cleanup
// TODO license

// Make a namespace.
if (typeof Murmuration == 'undefined') {
  var Murmuration = {};
}

/**
 * UI controller that is loaded into the main player window
 */
Murmuration.Controller = {

  /**
   * Called when the window finishes loading
   */
  onLoad: function() {

    // initialization code
    this._initialized = true;
    this._strings = document.getElementById("murmuration-strings");
    
    // Perform extra actions the first time the extension is run
    if (Application.prefs.get("extensions.murmuration.firstrun").value) {
      Application.prefs.setValue("extensions.murmuration.firstrun", false);
      this._firstRunSetup();
    }
    
    // XXX Megahack TODO.  To get things up and running the server
    // passes the account info via a cookie.  This is an extremely
    // bad idea.  Make sure this is fixed before any public release.
    var observerService = Components.classes["@mozilla.org/observer-service;1"]
                                    .getService(Components.interfaces.nsIObserverService);
    observerService.addObserver(this, "cookie-changed", false);    
    
    // XXX TODO MOVE
    Components.utils.import('resource://murmuration/main.jsm');
  },
  
  /**
   * Called when the window is about to close
   */
  onUnLoad: function() {
    this._initialized = false;
    var observerService = Components.classes["@mozilla.org/observer-service;1"]
                                    .getService(Components.interfaces.nsIObserverService);
    observerService.removeObserver(this, "cookie-changed");
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
        var account = parts[1];
        var password = parts[2];
      }
    }
  },
  
  /**
   * Perform extra setup the first time the extension is run
   */
  _firstRunSetup : function() {
  
    // Call this.doHelloWorld() after a 3 second timeout
    setTimeout(function(controller) { controller.doHelloWorld(); }, 3000, this); 
  
  }
};

window.addEventListener("load", function(e) { Murmuration.Controller.onLoad(e); }, false);
window.addEventListener("unload", function(e) { Murmuration.Controller.onUnLoad(e); }, false);
