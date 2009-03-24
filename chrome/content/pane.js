

// ADDITIONAL TODOS
// * Handle losing the connection
// * Handle multiple connections on the same account

var channel;


/**
 * Controller for the online friends display area.
 * Tracks who is online, etc.
 */
var onlineWidget = {
  _userData: {},
  
  setPresence: function(userName, isOnline) {
    if (isOnline) {
      // Make sure the user avatar is visible
      
      if (!(userName in this._userData)) {
        var controller = this;
        $.getJSON("http://skunk.grommit.com/api/users/show/" + userName + ".json",
          function(data){
            controller._userData[userName] = data;
            controller.setPresence(userName, isOnline);
          });
      }
      else {
        var data = this._userData[userName];
        $("<img/>").attr("src", data.profile_image_url)
                   .attr("username", data.screen_name)
                   .attr("class", "avatar")
                   .hide()
                   .appendTo("#online-container")
                   .fadeIn("slow");
      }
    }
    else {
      // Hide and kill the avatar
      
      $("#online-container img[username=" + userName + "]").fadeOut("slow", function() {
        $(this).remove();
      });
    }
  },
  
  init: function() {
    // Load current online friends
    var contactPresences = XMPP.cache.fetch({
        event     : 'presence',
        direction : 'in',
        stanza    : function(s) {
          return s.@type == undefined;
        }
    });
    for each(var presence in contactPresences) {
      var userName = XMPP.nickFor('mattc@skunk.grommit.com', presence.stanza.@from)
      this.setPresence(userName, true);  
    }
    
    // Hook up a listener so we get notified when people
    // come and go
    // TODO handle multiple accounts
    var controller = this;
    channel.on({
      event     : 'presence',
      direction : 'in',
      stanza    : function(s) {
          return true;
      }
    }, function(presence) {
      var userName = XMPP.nickFor('mattc@skunk.grommit.com', presence.stanza.@from)
      controller.setPresence(userName, presence.stanza.@type != 'unavailable');
    });
  },
  
  finish: function() {
    // TODO?    
  }
}


/**
 * TODO, data should be shared.
 */
var activityWidget = {
  
}

function init() {
  Components.utils.import('resource://xmpp4moz/xmpp.jsm');
  channel = XMPP.createChannel();
  onlineWidget.init();
  //setTimeout(function() {  onlineWidget.setPresence("mattc", false); }, 4000);
}

function finish() {
  onlineWidget.finish();
  channel.release();
}

window.addEventListener("load", init, false);
window.addEventListener("unload", finish, false);

