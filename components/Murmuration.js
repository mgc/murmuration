/*
//
// BEGIN SONGBIRD GPL
// 
// This file is part of the Songbird web player.
//
// Copyright(c) 2005-2007 POTI, Inc.
// http://songbirdnest.com
// 
// This file may be licensed under the terms of of the
// GNU General Public License Version 2 (the "GPL").
// 
// Software distributed under the License is distributed 
// on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either 
// express or implied. See the GPL for the specific language 
// governing rights and limitations.
//
// You should have received a copy of the GPL along with this 
// program. If not, go to http://www.gnu.org/licenses/gpl.html
// or write to the Free Software Foundation, Inc., 
// 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
// 
// END SONGBIRD GPL
//
 */

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://app/jsmodules/kPlaylistCommands.jsm");
Cu.import("resource://app/jsmodules/sbProperties.jsm");

function Murmuration()
{
  // We want to be notified when the default
  // playlist commands are ready, so we can add
  // ourselves after them
  var obs = Cc["@mozilla.org/observer-service;1"]
              .getService(Ci.nsIObserverService);
  obs.addObserver(this, "playlist-commands-ready", false);

  this.wrappedJSObject = this;
}

Murmuration.prototype.constructor = Murmuration;

var listeners = [];

Murmuration.prototype = {
	classDescription: "Playlist Commands Example",
	classID:          Components.ID("{4c9d953e-1dd2-11b2-96a2-9476767fdc26}"),
	contractID:       "@songbirdnest.com/Songbird/Murmuration;1", 

	m_Library : null,
	m_Commands : null,
  
	addListener: function(listener) {
		listeners.push(listener);
	},
	removeListener: function(listener) {
		for (;;) {
			let l = listeners.indexOf(listener);
			if (l >= 0)
				listeners.splice(l, 1);
			else
				return;
		}
	},
	init: function() {
		// Trap shutdown so we cleanup too
		var obs = Cc["@mozilla.org/observer-service;1"]
			.getService(Ci.nsIObserverService);
		obs.removeObserver(this, "playlist-commands-ready");
		obs.addObserver(this, "playlist-commands-shutdown", false);

		var libraryManager =
			Cc["@songbirdnest.com/Songbird/library/Manager;1"]
			.getService(Ci.sbILibraryManager);

		this.m_Library = libraryManager.mainLibrary;

		const PlaylistCommandsBuilder = new Components.
			Constructor("@songbirdnest.com/Songbird/PlaylistCommandsBuilder;1", 
					"sbIPlaylistCommandsBuilder");

		var mgr = Cc["@songbirdnest.com/Songbird/PlaylistCommandsManager;1"]
			.getService(Ci.sbIPlaylistCommandsManager);

		var defaultCommands = mgr.request(kPlaylistCommands.MEDIAITEM_DEFAULT);

		// Make a new command builder
		this.m_Commands = new PlaylistCommandsBuilder();

		// Append the default commands
		this.m_Commands.appendPlaylistCommands(null, "library_cmdobj_defaults",
				defaultCommands);

		// Make a new command builder for the Murmuration commands
		this.m_MurmurCommands = new PlaylistCommandsBuilder();
		// Make a separator, and add our Murmuration commands
		this.m_MurmurCommands.appendSeparator(null, "murmur_separator");
		this.m_MurmurCommands.
			appendAction(null,
					"murmur_sharetrack",
					"Murmur Track",
					"Share this track on Murmuration",
					this.plCmd_MurmurTrack);
		//this.m_MurmurCommands.setVisibleCallback(plCmd_IsAnyTrackSelected);

		this.m_Commands.appendPlaylistCommands(null, "library_cmdmurmurs",
				this.m_MurmurCommands);

		mgr.registerPlaylistCommandsMediaItem(this.m_Library.guid, 
				"", this.m_Commands);
		mgr.registerPlaylistCommandsMediaItem("", "smart", this.m_Commands);
		mgr.registerPlaylistCommandsMediaItem("", "simple", this.m_Commands);
	},
  
	// Shutdown
	shutdown: function() {
		var obs = Cc["@mozilla.org/observer-service;1"]
			.getService(Ci.nsIObserverService);
		obs.removeObserver(this, "playlist-commands-shutdown");

		var mgr = Cc["@songbirdnest.com/Songbird/PlaylistCommandsManager;1"]
			.getService(Ci.sbIPlaylistCommandsManager);

		mgr.unregisterPlaylistCommandsMediaItem(this.m_Library.guid, "", 
				this.m_Commands);
		mgr.unregisterPlaylistCommandsMediaItem("", "smart", this.m_Commands);
		mgr.unregisterPlaylistCommandsMediaItem("", "simple", this.m_Commands);

		// Cleanup
		this.m_Commands.shutdown();
		this.m_Commands = null;
	},
  
	// nsIObserver
	observe: function(aSubject, aTopic, aData) {
		switch (aTopic) {
			case "playlist-commands-ready":
				if (aData == "default")
					this.init();
			break;
			case "playlist-commands-shutdown":
				if (aData == "default")
					this.shutdown();
			break;
		}
	},

	plCmd_MurmurTrack: function(aContext, aSubMenuId, aCommandId, aHost) {
		var selection = unwrap(aContext.playlist).mediaListView.selection;
		var items = selection.selectedMediaItems;
		while (items.hasMoreElements()) {
			var item = items.getNext();
			dump("Triggering upload of: " + item.getProperty(SBProperties.contentURL) + " -- " + item.getProperty(SBProperties.contentLength) + "\n");
			var exists = false;
			for (var i=0; i<listeners.length; i++) {
				// Trigger listeners
				if (listeners[i].onBeforeTrackMurmured(item)) {
					dump("Track has already been murmured\n");
					exists = true;
				}
			}
			if (exists)
				break;

			// Get an nsIFile for the track
			var uri =
				Cc["@mozilla.org/network/io-service;1"]
				.getService(Ci.nsIIOService)
				.newURI(item.getProperty(SBProperties.contentURL), null, null);
			var file = uri.QueryInterface(Ci.nsIFileURL).file;
		
			// Try to guess its mime-type
			var mimeType = "text/plain";
			try {
				mimeType = Cc["@mozilla.org/mime;1"]
					  .getService(Ci.nsIMIMEService).getTypeFromFile(file);
			} catch (e) {
			};

			// Create a file input stream from the nsIFile
			var stream = Cc["@mozilla.org/network/file-input-stream;1"]
					   .createInstance(Ci.nsIFileInputStream);
			stream.init(file, 0x04 | 0x08, 0644, 0x04);

			// Create the XMLHttpRequest object
			var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
				.createInstance(Ci.nsIXMLHttpRequest);
			xhr.open("POST", "http://skunk.grommit.com/up.php", true);
			xhr.setRequestHeader("Content-Type", mimeType);
			var basename = item.getProperty(SBProperties.contentURL)
				.replace(/^.*[\/\\]/g, '');
			xhr.setRequestHeader("X-File-Name", basename);
			xhr.onreadystatechange = function() {
				if (this.readyState != 4)
					return;
				if (this.status == 200) {
					dump("Response:" + this.responseText + "\n");
					for (var i=0; i<listeners.length; i++) {
						// Trigger listeners
						listeners[i].onTrackMurmured(item,
								this.responseText);
					}
				}
			};
			xhr.send(stream);

			// TODO make it support multiple murmurs
			return;
		}
	},

	QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]) 
};

function NSGetModule(compMgr, fileSpec) {
	return XPCOMUtils.generateModule([Murmuration],
			function(aCompMgr, aFileSpec, aLocation) {
			XPCOMUtils.categoryManager.addCategoryEntry(
				"app-startup",
				Murmuration.prototype.classDescription,
				"service," + Murmuration.prototype.contractID,
				true,
				true);
			});
}

// Returns true when at least one track is selected in the playlist
function plCmd_IsAnyTrackSelected(aContext, aSubMenuId, aCommandId, aHost) {
  return ( unwrap(aContext.playlist).tree.currentIndex != -1 );
}

function unwrap(obj) {
	if (obj && obj.wrappedJSObject)
		obj = obj.wrappedJSObject;
	return obj;
}
