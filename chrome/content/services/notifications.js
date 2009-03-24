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

Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");
Cu.import("resource://app/jsmodules/ArrayConverter.jsm");
Cu.import("resource://app/jsmodules/sbProperties.jsm");

// STATE
// ----------------------------------------------------------------------

var channel;
var alertService;
var batchCount = 0;

// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
  alertService = Cc["@mozilla.org/alerts-service;1"]
                    .getService(Ci.nsIAlertsService);

  channel = XMPP.createChannel();

  channel.on({
      event     : 'message',
      direction : 'in',
      stanza    : function(s) {
          return (s.body != undefined ||
                  s.ns_xhtml_im::html.ns_xhtml::body != undefined);
      }
  }, function(m) { receiveNotification(m); });
  
  // Listen for rating events
  LibraryUtils.mainLibrary.addListener(this, false,
    Ci.sbIMediaList.LISTENER_FLAGS_ITEMUPDATED | 
    Ci.sbIMediaList.LISTENER_FLAGS_BATCHBEGIN | 
    Ci.sbIMediaList.LISTENER_FLAGS_BATCHEND);  
  
  // TODO fill the rest in...
  dump("\nnotification init complete\n");
}


// FINALIZATION
// ----------------------------------------------------------------------

function finish() {
    channel.release();
    delete alertsService;
    LibraryUtils.mainLibrary.removeListener(this);
}


// REACTIONS
// ----------------------------------------------------------------------

function receiveNotification(m) {
  alertService.showAlertNotification(
    "",
    "Notification",
    m.stanza.body
    /*
      in AString imageUrl, 
      in AString title, 
      in AString text, 
      [optional] in boolean textClickable,
      [optional] in AString cookie,
      [optional] in nsIObserver alertListener,
      [optional] in AString name New in Firefox 3
      */
  );
}


// sbIMediaListListener
// ----------------------------------------------------------------------


function onItemAdded(aMediaList, aMediaItem, aIndex) { return true; }

function onBeforeItemRemoved(aMediaList, aMediaItem, aIndex) { return true; }

function onAfterItemRemoved(aMediaList, aMediaItem, aIndex) { return true; }

function onItemUpdated(aMediaList, aMediaItem, aProperties) {
  // Do nothing if a batch is in progress
  if (batchCount == 0) {
    for (var prop in ArrayConverter.JSEnum(aProperties)) {
      if (prop.QueryInterface(Ci.sbIProperty).id == SBProperties.rating) {
        var rating = aMediaItem.getProperty(SBProperties.rating);
        sendNotification(aMediaItem, " rated " + rating);
        break;
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



// API
// ----------------------------------------------------------------------

// XXX TODO

// TODO break this up
function sendNotification(mediaItem, message) {
  // XXX TODO cleanup
  var artist = mediaItem.getProperty(SBProperties.artistName);
  var album = mediaItem.getProperty(SBProperties.albumName);
  var track = mediaItem.getProperty(SBProperties.trackName);
  message = "'" + track + "' by '" + artist + "'" + message;
  // XXX TODO probably need to escape this
  // XXX TODO which account?
  XMPP.send('mattc@skunk.grommit.com',
           <message to="murmuration@skunk.grommit.com"><body>{message}</body></message>);  
}
