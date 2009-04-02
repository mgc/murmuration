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

    // XXX TODO MOVE
    Components.utils.import('resource://murmuration/main.jsm');
  },
  
  /**
   * Called when the window is about to close
   */
  onUnLoad: function() {
    this._initialized = false;
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
