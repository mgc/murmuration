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
 

// ADDITIONAL TODOS
// * Handle losing the connection
// * Handle multiple connections on the same account


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
                 .click(function() 
                   loadInMediaTab("http://skunk.grommit.com/" +
                                  userData.screen_name))
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
      var userName = XMPP.nickFor(murmuration.account.jid, presence.stanza.@from)
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
      var userName = XMPP.nickFor(murmuration.account.jid, presence.stanza.@from)
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
    node.click(function() 
                loadInMediaTab("http://skunk.grommit.com/" +
                     user.screen_name));
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
    if (!murmuration.account.isConfigured) {
      throw("No account");
    }
    
    var u = murmuration.account.userName;
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


/**
 * Controller for the screen shown when the user account
 * has not yet been configured.
 */
var loggedOutPane = {
  
  init: function() {
    $("#register-link").click(function() 
      loadInMediaTab("http://skunk.grommit.com/main/register"));
    $("#login-link").click(function() 
      loadInMediaTab("http://skunk.grommit.com/main/login"));
  },
}


/**
 * Root controller for the entire window. Sets everything up.
 */
var windowController = {
  
  init: function() {
    Components.utils.import('resource://xmpp4moz/xmpp.jsm');
    Components.utils.import('resource://murmuration/main.jsm');

    channel = XMPP.createChannel();
    loggedOutPane.init();

    $("#viewall-link").click(function() 
        loadInMediaTab("http://skunk.grommit.com/"));

    // TODO handle no account, offline, etc    
    windowController.onAccountChange();    
    murmuration.account.addListener(windowController);
  },
  
  finish: function() {
    murmuration.account.removeListener(windowController);
    onlineWidget.finish();
    activityWidget.finish();
    channel.release();
  },
  
  onAccountChange: function() {
    if (murmuration.account.isConfigured) {
      $('#logged-out-pane').hide();
      $('#logged-in-pane').show("fast");
      onlineWidget.init();
      activityWidget.init();
    } else {
      $('#logged-in-pane').hide();
      $('#logged-out-pane').fadeIn("slow");
    }
  }
}


/** Utilities **/
function loadInMediaTab(url) {
  top.gBrowser.loadURI(url, 
    null, null, null, "_media");
}


/** Loading Hooks **/
window.addEventListener("load", windowController.init, false);
window.addEventListener("unload", windowController.finish, false);

