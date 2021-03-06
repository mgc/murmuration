// XXX TODO license.
// Copied from sameplace/contacts.js

// Displays incoming notifications, and monitors songbird events in order
// to generate notifactions.
// Loaded by main.jsm via the extensions.murmuration.services.notifications
// preference

// DEFINITIONS
// ----------------------------------------------------------------------

var pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.murmuration.services.notifications.');
var extpref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.murmuration.');

Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");
Cu.import("resource://app/jsmodules/ArrayConverter.jsm");
Cu.import("resource://app/jsmodules/sbProperties.jsm");
Cu.import('resource://murmuration/main.jsm');

// STATE
// ----------------------------------------------------------------------

var channel;
var alertService;
var batchCount = 0;

var notificationFloodCounter = 0;
var notificationFloodTimestamp;
var notificationFloodProtection = false;

var newLists = []

// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
  // XXX This throws an exception when growl isn't installed?
  try {
	  alertService = Cc["@mozilla.org/alerts-service;1"]
						.getService(Ci.nsIAlertsService);
  } catch (e) {
	  alertService = null;
  }

  channel = XMPP.createChannel();

  channel.on(function(e) {
    if (e.name != 'message' || e.direction != 'in')
	  return;
	receiveNotification(e);
  });
  
  // Listen for rating events
  LibraryUtils.mainLibrary.addListener(this, false,
    Ci.sbIMediaList.LISTENER_FLAGS_ITEMADDED | 
    Ci.sbIMediaList.LISTENER_FLAGS_BEFOREITEMREMOVED | 
    Ci.sbIMediaList.LISTENER_FLAGS_ITEMUPDATED | 
    Ci.sbIMediaList.LISTENER_FLAGS_BATCHBEGIN | 
    Ci.sbIMediaList.LISTENER_FLAGS_BATCHEND);  
  
  // Check to see if Last.fm is installed and add a listener if it is
  if ("sbILastFm" in Ci) {
	  this.lfm = Cc["@songbirdnest.com/lastfm;1"].getService().wrappedJSObject;
	  this.lfm.listeners.add(this);
  }

  // Add ourselves as a playlist history listener
  var playbackHistory =
  	      Cc['@songbirdnest.com/Songbird/PlaybackHistoryService;1']
  	      .getService(Ci.sbIPlaybackHistoryService);
  playbackHistory.addListener(this);

  // TODO fill the rest in...
  dump("\nnotification init complete\n");
}


// FINALIZATION
// ----------------------------------------------------------------------

function finish() {
    channel.release();
    delete alertsService;
    LibraryUtils.mainLibrary.removeListener(this);
    if ("sbILastFm" in Ci) {
      var lfm = Cc["@songbirdnest.com/lastfm;1"].getService().wrappedJSObject;
      lfm.listeners.remove(this);
    }

    var playbackHistory =
      Cc['@songbirdnest.com/Songbird/PlaybackHistoryService;1']
        .getService(Ci.sbIPlaybackHistoryService);
    playbackHistory.removeListener(this);
}


// REACTIONS
// ----------------------------------------------------------------------

function receiveNotification(m) {
	if (!alertService)
		return;

	var now = Math.floor(Date.now()/1000);
	//dump("notification @ " + now + " ?= " + notificationFloodTimestamp + 
	//		" // " + notificationFloodProtection + "\n");
	// If we receive >= 10 notifications in the same second, then enable
	// flood protection
	if (notificationFloodTimestamp == now) {
		// if this notification is at the same time, then increment the counter
		if (notificationFloodCounter++ == 10) {
			//dump("Notifying of flood\n");
			alertService.showAlertNotification("", "murmuration",
				"Flood protection activated");
			notificationFloodProtection = true;
			return;
		} else if (notificationFloodCounter > 10) {
			//dump("Within flood protection window\n");
			return;
		}
	} else if (notificationFloodProtection) {
		// keep flood protection enabled for a rolling 10 second window
		if (Math.abs(notificationFloodTimestamp - now) < 10) {
			//dump("Within flood protection window\n");
			notificationFloodTimestamp = now;
			return;
		}
	
		// if we got here then we're past the 5 second window, so reset the
		// counters
		//dump("Resetting flood protection\n");
		notificationFloodCounter = 0;
		notificationFloodTimestamp = now;
		notificationFloodProtection = false;
	} else {
		notificationFloodTimestamp = now;
	}

	// ignore Murmuration DM responses
	var msg = m.stanza.body.toString();
	//dump("RECVD:" + msg + "\n");
	if (/^\[Murmuration\]/.exec(msg)) {
		dump("Ignoring direct message response\n");
		return;
	}

	var actionCommand = /^#([a-zA-Z]+) !(\w+) (.*)/.exec(msg);
	if (actionCommand) {
		dump("got action command\n");
		var username = actionCommand[2];
		msg = /^!url:([^\s]+) (.*)\s*\#mid(\d+)$/.exec(actionCommand[3]);
		var url = msg[1];
		var noticeId = msg[3];
		msg = msg[2];
		msg = username + " shared the following track with you: " + msg;
	}

	//var txt = msg.replace(/#r?id\d+/g, "");
	var txt = murmuration.formatMsgForDisplay(msg);

	if (extpref.getBoolPref("personalise_notifications"))
	{
		var atomNS = new Namespace("http://www.w3.org/2005/Atom");
		var x = m.stanza.atomNS::entry.atomNS::source;
		var userAvatar = x.atomNS::icon.toString();
		var userName = x.atomNS::author.atomNS::name.toString();
		alertService.showAlertNotification(userAvatar, userName, txt);
	} else {
		alertService.showAlertNotification("", "Notification", txt);
	}
    /*
      in AString imageUrl, 
      in AString title, 
      in AString text, 
      [optional] in boolean textClickable,
      [optional] in AString cookie,
      [optional] in nsIObserver alertListener,
      [optional] in AString name New in Firefox 3
      */
}


// sbIMediaListListener
// ----------------------------------------------------------------------


function onItemAdded(aMediaList, aMediaItem, aIndex) {
	if (aMediaItem.getProperty(SBProperties.isList) == 1) {
		// track it in the newLists hash
		newLists[aMediaItem.guid] = true;
	}
	return true;
}

function onBeforeItemRemoved(aMediaList, aMediaItem, aIndex) {
	if (aMediaItem.getProperty(SBProperties.isList) == 1)
		sendNotification(aMediaItem, " #list 0");
	return true;
}

function onAfterItemRemoved(aMediaList, aMediaItem, aIndex) { return true; }

function onItemUpdated(aMediaList, aMediaItem, aProperties) {
  // Do nothing if a batch is in progress
  if (batchCount == 0) {
    for (var prop in ArrayConverter.JSEnum(aProperties)) {
      if (prop.QueryInterface(Ci.sbIProperty).id == SBProperties.rating) {
        //var rating = parseInt(aMediaItem.getProperty(SBProperties.rating));
        var ratingText = aMediaItem.getProperty(SBProperties.rating);
		if (ratingText == null)
			ratingText = 0;
        
/* Booo, doesn't work
        ratingText = "";
        for (var i = 1; i < 5; i++) {
          if (i <= rating) {
            ratingText += "&#9733;";
          } else {
            ratingText += "&#9734;";
          }
        }
*/        
        sendNotification(aMediaItem, " #rated " + ratingText);
        break;
      } else if (prop.id == SBProperties.mediaListName) {
		if (aMediaItem.name == "Playlist")
			return true;
		// check to see if this was a newly created list
		// otherwise it's just a rename
		if (newLists[aMediaItem.guid] == true) {
			dump("New playlist:" + aMediaItem.name + "\n");
			sendNotification(aMediaItem, " #list 1");
			delete newLists[aMediaItem.guid];
		}
	  }
    }
  }
  else {
    return true;   
  }  
}

function onItemMoved(aMediaList, aFromIndex, aToIndex) { return true;}

function onListCleared(aMediaList) { return true; }

function onBatchBegin(aMediaList) {
  batchCount++;
}

function onBatchEnd(aMediaList) {
  batchCount--;  
}

// sbILastFm Listener
// ----------------------------------------------------------------------
function onShouldScrobbleChanged() { return true; }
function onUserLoggedOutChanged() { return true; }
function onErrorChanged() { return true; }
function onLoggedInStateChanged() { return true; }
function onLoginBegins() { return true; }
function onLoginFailed() { return true; }
function onLoginCancelled() { return true; }
function onLoginSucceeded() { return true; }
function onProfileUpdated() { return true; }
function onAuthorisationSuccess() { return true; }
function onItemTagsAdded(aItem, tags) {
	var tagString = tags.join(",");
	sendNotification(aItem, " #tagged " + tagString);
}
function onItemTagRemoved(aItem, tag) {
	sendNotification(aItem, " #untagged with " + tag);
}
function onLoveBan(aItem, love, existing) {
	if (!aItem || existing)
		return;
	if (love)
		sendNotification(aItem, " #loved!");
	else
		sendNotification(aItem, " #banned!");
}

// sbIPlaybackHistoryListener
// ----------------------------------------------------------------------
function onEntriesAdded(aEntries) {
  for (var entry in ArrayConverter.JSEnum(aEntries)) {
    entry = entry.QueryInterface(Ci.sbIPlaybackHistoryEntry);
    sendNotification(entry.item, " #played #guid " + entry.item.guid);
  }
}


// API
// ----------------------------------------------------------------------

// XXX TODO

// TODO break this up
function sendNotification(mediaItem, message) {
	// XXX TODO cleanup
	if (mediaItem.getProperty(SBProperties.isList) == 0) {
		var artist = mediaItem.getProperty(SBProperties.artistName);
		var album = mediaItem.getProperty(SBProperties.albumName);
		var track = mediaItem.getProperty(SBProperties.trackName);
		message = "'" + track + "' by '" + artist + "'" + message;
	} else {
		message = mediaItem.name + message;
	}
	// XXX TODO probably need to escape this
	XMPP.send(murmuration.account.address,
		   <message to="murmuration@skunk.grommit.com"><body>{message}</body></message>);  
	}
