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

// Loaded in to the main Songbird window.  Does nothing at the moment.
// This code was generated by the developer tools extension wizard.

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
