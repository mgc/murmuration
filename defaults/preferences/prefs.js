

// Used to detect the first time the extension is run 
pref("extensions.murmuration.firstrun", true);

// See http://kb.mozillazine.org/Localize_extension_descriptions
// pref("extensions.{b3ed606a-4fc0-ac4b-bfc0-4a89088fef3b}.description", "chrome://murmuration/locale/murmuration.properties");

// Register services to be loaded by main.jsm
pref("extensions.murmuration.services.notifications.src", "chrome://murmuration/content/services/notifications.js");