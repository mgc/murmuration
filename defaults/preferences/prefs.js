// Your Laconica/ejabberd username
pref("extensions.murmuration.username", "");
pref("extensions.murmuration.password", "");

// Used to detect the first time the extension is run 
pref("extensions.murmuration.firstrun", true);

// Whether to use external IP or not
pref("extensions.murmuration.external_ip", false);

// Whether to personalise Growl notifications or not
pref("extensions.murmuration.personalise_notifications", true);

// See http://kb.mozillazine.org/Localize_extension_descriptions
// pref("extensions.{b3ed606a-4fc0-ac4b-bfc0-4a89088fef3b}.description", "chrome://murmuration/locale/murmuration.properties");

// Register services to be loaded by main.jsm
pref("extensions.murmuration.services.notifications.src", "chrome://murmuration/content/services/notifications.js");
