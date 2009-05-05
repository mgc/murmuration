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
 *
 * This file is based on main.jsm from SamePlace by Massimiliano Mirra
 */

// Main import for murmuration services.  
// Exposes murmuration.services and murmuration.account


// EXPORTS
// ----------------------------------------------------------------------

var EXPORTED_SYMBOLS = ['murmuration'];


// DEFINITIONS
// ----------------------------------------------------------------------

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var loader = Cc['@mozilla.org/moz/jssubscript-loader;1']
    .getService(Ci.mozIJSSubScriptLoader);
var srvObserver = Cc['@mozilla.org/observer-service;1']
    .getService(Ci.nsIObserverService);

var prefServices = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.murmuration.services.');

Cu.import('resource://xmpp4moz/xmpp.jsm');
Cu.import('resource://xmpp4moz/json.jsm');
Cu.import('resource://xmpp4moz/namespaces.jsm');
Cu.import('resource://xmpp4moz/log.jsm');
Cu.import('resource://xmpp4moz/client_service.jsm');

Cu.import('resource://murmuration/account.jsm');


// STATE
// ----------------------------------------------------------------------

var channel;
var services = {};
var observer;
var connectionObserver;

// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
  channel = XMPP.createChannel();

  account.init();

  loadServices();

  var connectionObserver = {
	  observe: function(subject, topic, data) {
		  if (topic == "connector-connected") {
			  // Get the connector somehow
			  var connector = subject;

			  // Find out the IP address for this connector
			  var svc = Cc["@songbirdnest.com/Songbird/MurmurationUtilities;1"]
								   .createInstance(Ci.sbIMurmurationUtilities);
			  murmuration.ip = svc.getIPAddress(connector._socket._transport);
			  dump("setting ip to:" + murmuration.ip + "\n");
		  }
	  }
  };
  service.addObserver(connectionObserver, 'not-used', false);

  restoreOnlineState();

  observer = { observe: function(subject, topic, data) { finish(); }};
  srvObserver.addObserver(
      observer,
      'quit-application',
      false);
}

function finish() {  
  srvObserver.removeObserver(observer, 'quit-application');
  delete observer;

  for(var serviceName in services) {
    if(typeof(services[serviceName].finish) == 'function') {
      try {
          services[serviceName].finish();
      } catch(e) {
          dump('Error while stopping service "' + serviceName + '":\n' +
               e + '\n' +
               (e.stack ? e.stack + '\n' : ''));
      }
    }
  }
  
  account.finish();
  
  channel.release();
}


// ACTIONS
// ----------------------------------------------------------------------

function loadServices() {
    for each(let keyName in prefServices.getChildList('', {})) {
        let [serviceName, subProperty] = keyName.split('.');
        if(subProperty != 'src')
            continue;

        try {
            let service = {};
            loader.loadSubScript(prefServices.getCharPref(keyName), service);
            service.init();
            services[serviceName] = service;
        } catch(e) {
            Cu.reportError(e + ' (' + e.fileName + ', line ' + e.lineNumber + ')');
        }
    }
}


// ACTIONS
// ----------------------------------------------------------------------

// To be called at startup.  Brings up accounts that were online last
// time the application was closed.

function restoreOnlineState() {
    XMPP.accounts
        .forEach(function(account) {
            var history = JSON.parse(account.presenceHistory || '[]');

            var lastPresenceStanza = new XML(history[history.length-1]);
            if(lastPresenceStanza.@type != 'unavailable')
                XMPP.up(account);
        });
}


// KICKSTART
// ----------------------------------------------------------------------

var murmuration = {
    services: services,
    account: account,
	ip: null,
};

init();
