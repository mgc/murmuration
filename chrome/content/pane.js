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

if (typeof(Cu) == "undefined")
	const Cu = Components.utils;
if (typeof(Cc) == "undefined")
	const Cc = Components.classes;
if (typeof(Ci) == "undefined")
	const Ci = Components.interfaces;

if (typeof(gMM) == "undefined")
	var gMM = Cc["@songbirdnest.com/Songbird/Mediacore/Manager;1"]
		.getService(Ci.sbIMediacoreManager);

Cu.import("resource://app/jsmodules/sbProperties.jsm");

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


var MRMR_NS = "http://skunk.grommit.com/data/1.0#murmuration";
/**
 * Controller for the recent activity display.
 * Fetches friend timeline on load, and listens
 * for new notifications via the XMPP channel.
 */
var activityWidget = {
  
  _showNotification: function(text, user, shouldAnimate, noticeId, url) {
    // TODO ensure user
    
	// check to see if this is a reply to a previous notice
	var replyMessage = /(.*)\s*#rid(\d+)(.*)/.exec(text);
	var inReplyToNode;
	if (replyMessage) {
		var replyNoticeId = replyMessage[2];
		text = replyMessage[1];
		$(".notification").each(function(i) {
			if ((this.getAttributeNS(MRMR_NS, "noticeId") == replyNoticeId) ||
				(this.getAttributeNS(MRMR_NS, "origRNID") == replyNoticeId)) {
				inReplyToNode = this;
			}
		});
	}

	// if it's a reply, clone the reply-notification template
	// otherwise clone the regular notification template
	if (inReplyToNode)
		var node = $("#reply-notification-template > .notification").clone();
	else {
		var node = $("#notification-template > .notification").clone();
	
		// set the reply icon click handler to allow the user to comment on
		// this notice
		$(".reply-icon", node).click(function(ev) {
			var panel =
				window.top.document.getElementById("murmuration-comment-panel");
			panel.openPopup(ev.target);
			var commentBox = window.top.document.getElementById("new-comment");
			commentBox.setAttributeNS(MRMR_NS, "user", user.screen_name);
			commentBox.setAttributeNS(MRMR_NS, "noticeId", noticeId);
			commentBox.value = "";
			ev.stopPropagation();
			ev.preventDefault();
		});
	}

	// set the noticeId in an attribute so we can reference it later
	node.get(0).setAttributeNS(MRMR_NS, "noticeId", noticeId);

	// if there's a URL that goes along with this, then it's a track-sharing
	// notice.  setup the click handler so the user can play the track
	if (url) {
		node.addClass("share-track");
		node.click(function() {
			var uri = Cc["@mozilla.org/network/io-service;1"]
				.getService(Ci.nsIIOService)
				.newURI(url, null, null);
			dump("Playing:" + url + "\n");
			gMM.sequencer.playURL(uri);
		});
	// otherwise it's a regular notice, and default the click handler to open
	// the user's laconica page
	} else {
		node.click(function() {
			loadInMediaTab("http://skunk.grommit.com/" + user.screen_name);
		});
	}

	// tag => action parsing
	if (text.indexOf("#played") >= 0) {
		// strip #played tags, don't bother including an action icon since
		// this will be the most commonly displayed notice
		text = text.replace("#played", "");
	} else {
		// matches the following commands
		//   * #tagged foo,bar
		//   * #rated 0-9
		// and probably more than it should... 

		// trim leading/trailing whitespace
		var result = text.match(/^\s*(.*\S)\s*$/);
		if (result !== null && result.length === 2)
			text = result[1];
		
		var command = /#(\w+)\s*(.*)?$/.exec(text);
		var actionIcon = $(".action img", node);
		if (command) {
			switch (command[1]) {
				case "banned":
					text = text.replace("#banned ", "banned");
					actionIcon.addClass("ban");
					break;
				case "loved":
					text = text.replace("#loved ", "loved");
					actionIcon.addClass("love");
					break;
				case "tagged":
					text = text.replace("#tagged ", "tagged: ");
					actionIcon.addClass("tag");
					break;
				case "rated":
					text = text.replace("#rated " + command[2], "");
					actionIcon.addClass("rating");
					actionIcon.addClass("rating-" + command[2]);
					break;
				case "list":
					actionIcon.addClass("list");
					text = text.replace("#list " + command[2], "");
					if (command[2] == "1")
						text = "created playlist: " + text;
					else
						text = "deleted playlist: " + text;
					break;
				default:
					dump("Unknown command: " + command[1] + "\n");
					dump("Text: " + text + "\n");
			}
		}
	}
	// set the user avatar and body of the notice
    $(".avatar img", node).attr("src", user.profile_image_url)
                  .attr("alt", user.screen_name); // XXX hack
    $(".content", node).text(text);

    if (shouldAnimate) {
      node.hide();
    }

	// position the notice accordingly
	if (inReplyToNode) {
		node.addClass("reply");
		node.get(0).setAttributeNS(MRMR_NS, "origRNID", replyNoticeId);
		$(inReplyToNode).after(node);
	} else {
		node.prependTo("#activity-container");
	}

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
              notification.user, false, notification.id);
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

	  var actionCommand = /^#([a-zA-Z]+) !(\w+) (.*)$/.exec(message);
	  if (actionCommand) {
	    var cmd = actionCommand[1];
		var userName = actionCommand[2];
		var message = actionCommand[3];
		switch (cmd) {
		  // direct message w/ track sharing
		  case "track":
			message = /^!url:([^\s]+) (.*)\s*\#mid(\d+)$/.exec(message);
			var url = message[1];
			var noticeId = message[3];
			message = message[2];
			dump("Track message " + message + " from " + userName + "\n");
			dump("url:" + url + "\n");
			laconica.callWithUserData(userName, function(data) {
			  controller._showNotification(message, data, true, noticeId, url);
			});
			break;
		  case "stream":
			message = /^!url:([^\s]+) (.*)\s*\#mid(\d+)$/.exec(message);
			var url = message[1];
			var noticeId = message[3];
			message = message[2];
			dump("Stream message " + message + " from " + userName + "\n");
			dump("url:" + url + "\n");
			laconica.callWithUserData(userName, function(data) {
			  controller._showNotification(message, data, true, noticeId, url);
			});
			break;
	      default:
			dump("Unknown action command:" + m.stanza.body + "\n");
		}
	  } else {
		  message = /^(\w+):(.*)$/.exec(message);
		  if (message[1]) {
			  var userName = message[1];
			  message = message[2];
			  message = /^(.*)\s*\#id(\d+)$/.exec(message);
			  noticeId = message[2];
			  message = message[1];
			  laconica.callWithUserData(userName, function(data) {
				controller._showNotification(message, data, true, noticeId);
			  });
		  }
	  }
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
		
	// Add Murmuration listeners
	var mrmr = Cc["@songbirdnest.com/Songbird/Murmuration;1"]
		.getService(Ci.nsIObserver).wrappedJSObject;
	mrmr.addListener(Murmur);
  },
  
  finish: function() {
	var mrmr = Cc["@songbirdnest.com/Songbird/Murmuration;1"]
		.getService(Ci.nsIObserver).wrappedJSObject;
	mrmr.removeListener(Murmur);
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

var Murmur = {
	murmuredTracks: null,

	onBeforeTrackMurmured: function(item) {
		return Murmur.beforeTrackMurmured_POST(item);
	},
	onTrackMurmured: function(item, url) {
		//return Murmur.trackMurmured_POST(item, url);
		return Murmur.trackMurmured(item, url);
	},

	// POST to skunk implementation
	beforeTrackMurmured_POST: function(item) {
		if (Murmur.murmuredTracks == null)
			Murmur.murmuredTracks = new Array();

		var alreadyExists = false;
		if (typeof(Murmur.murmuredTracks[item.guid]) == "undefined")
			Murmur.murmuredTracks[item.guid] = new Object();
		else
			alreadyExists = true;
					
		var panel = window.top.document
			.getElementById("murmuration-share-panel");
		var vbox = window.top.document
			.getElementById("murmur-vbox");
		while (vbox.firstChild)
			vbox.removeChild(vbox.firstChild);
		
		// Load current online friends
		var contactPresences = XMPP.cache.fetch({
			event     : 'presence',
			direction : 'in',
			stanza    : function(s) {
			  return s.@type == undefined;
			}
		});
		for each(var presence in contactPresences) {
			var userName =
				XMPP.nickFor(murmuration.account.jid, presence.stanza.@from)
			var doc = window.top.document;
			laconica.callWithUserData(userName, function(user) {
				var userDiv = doc.createElement("div");
				userDiv.className = "user";
				var img = doc.createElement("image");
				img.className = "user-avatar";
				img.setAttribute("src", user.profile_image_url);
				img.setAttributeNS(MRMR_NS, "username", user.screen_name);
				var name = doc.createElement("label");
				name.className = "user-name";
				name.setAttribute("value", user.screen_name);

				img.addEventListener("click", function() {
					var username = this.getAttributeNS(MRMR_NS, "username");
					// check to see if the post to skunk has already happened
					// if it has, then share immediately - otherwise append
					// this user to the shareWith queue
					if (typeof(Murmur.murmuredTracks[item.guid].url) !=
						 	"undefined")
					{
						dump("track has posted! now sharing\n");
						Murmur.shareTracks(Murmur.murmuredTracks[item.guid],
								username);
					} else {
						dump("track hasn't posted, appending " + username +
							" to queue\n");
						if (!Murmur.murmuredTracks[item.guid].shareWith)
							Murmur.murmuredTracks[item.guid].shareWith =
									new Array()
						Murmur.murmuredTracks[item.guid].shareWith.push(username);
						// The track will then be shared by the onTrackMurmured
						// hook below
					}
				}, false);

				userDiv.appendChild(img);
				userDiv.appendChild(name);
				vbox.appendChild(userDiv);
			});
		}
		
		dump("opening popup\n");
		var x = window.top.screenX + (window.top.innerWidth/2);
		var y = window.top.screenY + (window.top.innerHeight/2);
		panel.openPopupAtScreen(x, y);
		
		// If the post to skunk has already happened, then return true so
		// that MurmurTrack won't re-post it
		return alreadyExists;
	},

	trackMurmured_POST: function(item, url) {
		if (typeof(Murmur.murmuredTracks[item.guid]) == "undefined")
			Murmur.murmuredTracks[item.guid] = new Object();
		Murmur.murmuredTracks[item.guid].url = url;
		Murmur.murmuredTracks[item.guid].item = item;

		// If the user has already selected the users to share with, then
		// go straight to the sharing bit
		if (typeof(Murmur.murmuredTracks[item.guid].shareWith) != "undefined") {
			dump("user queue found, sharing now\n");
			Murmur.shareTracks(Murmur.murmuredTracks[item.guid]);
		} else {
			dump("users haven't been selected yet\n");
		}
	},

	trackMurmured: function(item) {
		// grab the panel and clear its existing contents
		var panel = window.top.document
			.getElementById("murmuration-share-panel");
		var vbox = window.top.document
			.getElementById("murmur-vbox");
		while (vbox.firstChild)
			vbox.removeChild(vbox.firstChild);
		
		// Load current online friends
		var contactPresences = XMPP.cache.fetch({
			event     : 'presence',
			direction : 'in',
			stanza    : function(s) {
			  return s.@type == undefined;
			}
		});

		var numContacts = 0;
		for each(var presence in contactPresences) {
			var userName =
				XMPP.nickFor(murmuration.account.jid, presence.stanza.@from);
			var doc = window.top.document;
			if (typeof(murmuration.account.friends[userName]) == "undefined" ||
					userName == murmuration.account.userName) 
				continue;
			laconica.callWithUserData(userName, function(user) {
				numContacts++;
				var userDiv = doc.createElement("vbox");
				userDiv.className = "user";
				var img = doc.createElement("image");
				img.className = "user-avatar";
				img.setAttribute("src", user.profile_image_url);
				img.setAttributeNS(MRMR_NS, "username", user.screen_name);
				var name = doc.createElement("label");
				name.className = "user-name";

				// wrap in case it's > 9 chars
				var displayname = user.screen_name;
				if (displayname.length > 8) {
					dump("wrapping " + displayname + "\n");
					displayname = displayname.substr(0, 7) + "..";
				}
				name.setAttribute("value", displayname);

				userDiv.appendChild(img);
				userDiv.appendChild(name);
				vbox.appendChild(userDiv);

				// no point in sharing tracks with yourself
				if (userName == murmuration.account.userName) {
					userDiv.className = "user-disabled";
					return;
				}

				img.addEventListener("click", function() {
					// parentNode should be the "user" div
					this.parentNode.className = "user-disabled";

					// remove the click listener
					this.removeEventListener("click", arguments.callee , false);

					// send the stream URL to the user
					var username = this.getAttributeNS(MRMR_NS, "username");
					Murmur.streamTracks(item, username);
				}, false);

			});
		}
		
		dump(numContacts + " contacts online\n");
		// resize the sharing panel
		var contactsPerSide = Math.ceil(Math.sqrt(numContacts));
		dump(contactsPerSide + " per side\n");

		var pxPerSide = contactsPerSide * 60;
		vbox.style.width = pxPerSide + "px";
		dump("width:" + vbox.style.width + "\n");
		
		var x = window.top.screenX + (window.top.innerWidth/2) -
			(pxPerSide / 2);
		var y = window.top.screenY + (window.top.innerHeight/2) -
			(pxPerSide / 2);
		panel.openPopupAtScreen(x, y);
	},

	// POST method of sharing
	shareTracks: function(trackShare, user) {
		var url = trackShare.url;
		var item = trackShare.item;
		var users = trackShare.shareWith;

		var artist = item.getProperty(SBProperties.artistName);
		var title = item.getProperty(SBProperties.trackName);

		if (user) {
			dump("sharing " + artist + "-" + title + " with " + user + "\n");
			var me = murmuration.account.userName;
			var message = "d " + user + " #track !" + me + " !url:" + url + " " + title + " by " + artist;
			dump(message + "\n");
			XMPP.send(murmuration.account.address,
				<message to="murmuration@skunk.grommit.com"><body>{message}</body></message>);
		} else {
			users.forEach(function(user) {
				Murmur.shareTracks(trackShare, user);
			});
		}
	},
	
	// STREAM method of sharing
	streamTracks: function(item, user) {
		if (Application.prefs.getValue("extensions.murmuration.external_ip",
					false))
		{
			var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
				.createInstance(Ci.nsIXMLHttpRequest);
			xhr.open("GET", "http://skunk.grommit.com/ip.php", true);
			xhr.onreadystatechange = function() {
				if (this.readyState != 4)
					return;
				if (this.status == 200) {
					var publicIP = this.responseText;
					Murmur.sendStreamMessage(publicIP, item, user);
				}
			};
			xhr.send(null);
		} else {
			dump("my IP: " + murmuration.ip + "\n");
			Murmur.sendStreamMessage(murmuration.ip, item, user);
		}
	},

	sendStreamMessage: function(host, item, user) {
		var artist = item.getProperty(SBProperties.artistName);
		var title = item.getProperty(SBProperties.trackName);
		var p = Application.prefs.getValue("extensions.httpserv.port", 38080);
		var me = murmuration.account.userName;

		var url = "http://" + host + ":" + p + "/contents/items/" + item.guid;
		var message = "d " + user + " #stream !" + me + " !url:" +
			url + " " + title + " by " + artist;
		dump(message + "\n");
		XMPP.send(murmuration.account.address,
			<message to="murmuration@skunk.grommit.com"><body>{message}</body></message>);
	}
}


/** Loading Hooks **/
window.addEventListener("load", windowController.init, false);
window.addEventListener("unload", windowController.finish, false);

