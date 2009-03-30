

// ADDITIONAL TODOS
// * Handle losing the connection
// * Handle multiple connections on the same account
// * Actions

var channel;


/**
 * Lame abstraction for laconica user data.
 * TODO should probably clean this up and move it to jsm land?
 */
var laconica = {
  _userData: {},

  callWithUserData: function(userName, func) {
    if (!(userName in this._userData)) {
      var controller = this;
      $.getJSON("http://skunk.grommit.com/api/users/show/" + userName + ".json",
        function(data){
          controller._userData[userName] = data;
          func(data);
        });
    }
    else {
      func(this._userData[userName]);
    }
  }
}


/**
 * Controller for the online friends display area.
 * Tracks who is online, etc.
 */
var onlineWidget = {
  
  setPresence: function(userName, isOnline) {
    var controller = this;
    laconica.callWithUserData(userName, function(data) {
      controller.setPresenceWithData(data, isOnline);
    });
  },
  
  setPresenceWithData: function(userData, isOnline) {
    if (isOnline) {   
      // Create a new avatar   
      $("<img/>").attr("src", userData.profile_image_url)
                 .attr("username", userData.screen_name)
                 .attr("class", "avatar")
                 .attr("alt", userData.screen_name)
                 .hide()
                 .appendTo("#online-container")
                 .fadeIn("slow");
    }
    else {
      // Hide and kill the avatar
      $("#online-container img[username=" + userData.screen_name + "]")
        .fadeOut("slow", function() {
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
      var u = Application.prefs.getValue("extensions.murmuration.username", "");
      var userName = XMPP.nickFor(u+'@skunk.grommit.com', presence.stanza.@from)
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
      var u = Application.prefs.getValue("extensions.murmuration.username", "");
      var userName = XMPP.nickFor(u+'@skunk.grommit.com', presence.stanza.@from)
      controller.setPresence(userName, presence.stanza.@type != 'unavailable');
    });
  },
  
  finish: function() {
    // TODO?    
  }
}


/**
 * Controller for the recent activity display.
 * Fetches friend timeline on load, and listens
 * for new notifications via the XMPP channel.
 */
var activityWidget = {
  
  _showNotification: function(text, user, shouldAnimate) {
    // TODO ensure user
    
    var node = $("#notification-template > .notification").clone();
    $("img", node).attr("src", user.profile_image_url)
                  .attr("alt", user.screen_name); // XXX hack
    $(".content", node).text(text);
    if (shouldAnimate) {
      node.hide();
    }
    node.prependTo("#activity-container");
    if (shouldAnimate) {
      node.fadeIn("slow");
    }
    
    // TODO should pop oldest notifications after a certain point
  },
  
  init: function() {
    // TODO error handling
    // TODO XXX set up account properly
    var u = Application.prefs.getValue("extensions.murmuration.username", "");
    var controller = this;
    // Fetch previous activity
    $.getJSON("http://skunk.grommit.com/api/statuses/friends_timeline/" + u + ".json",
      function(data){
        $("#activity-container").hide();
        for each (var notification in data.reverse()) {
          controller._showNotification(notification.text, 
              notification.user, false);
        }
        $("#activity-container").fadeIn("slow");
      });
    
    // Listen for new notifications  
    // TODO listen only to messages from the murmuration bot?
    channel.on({
      event     : 'message',
      direction : 'in',
      stanza    : function(s) {
          return (s.body != undefined ||
                  s.ns_xhtml_im::html.ns_xhtml::body != undefined);
      }
    }, function(m) { 
      // XXX fix error detection, user lookup
      var message = m.stanza.body;
      message = /^(\w+):(.*)$/.exec(message);
      var userName = message[1];
      message = message[2];
      laconica.callWithUserData(userName, function(data) {
        controller._showNotification(message, data, true);
      });
    });
  },
  
  finish: function() {
    // TODO?
  }
}


var loggedOutPane = {
  init: function() {
    $("#register-link").click(function() 
      loadInMediaTab("http://skunk.grommit.com/main/register"));
    $("#login-link").click(function() 
      loadInMediaTab("http://skunk.grommit.com/main/login"));
  },
}


/** Utilities **/
function loadInMediaTab(url) {
  top.gBrowser.loadURI(url, 
    null, null, null, "_media");
}


/** Loading Hooks **/

function init() {
  Components.utils.import('resource://xmpp4moz/xmpp.jsm');
  
  // TODO handle no account, offline, etc
  channel = XMPP.createChannel();
  onlineWidget.init();
  activityWidget.init();
  loggedOutPane.init();
}

function finish() {
  onlineWidget.finish();
  activityWidget.finish();
  channel.release();
}

window.addEventListener("load", init, false);
window.addEventListener("unload", finish, false);

