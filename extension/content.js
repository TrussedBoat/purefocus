// Runs on every site PureFocus handles and enforces the settings from inside
// the page.
//
// The network rules in background.js only act when the browser loads a new
// page. They miss a lot: these sites are single-page apps (clicking a link
// changes the URL without loading a page), YouTube can serve itself from its
// own offline cache, and Back/Forward can restore a page from memory. This
// script catches all of those by checking the settings and the URL itself.

const host = location.hostname;
const SITE = host.endsWith("youtube.com")
  ? {
      siteKey: "youtube",
      partKey: "youtubeShorts",
      cssClass: "pf-hide-shorts",
      home: "https://www.youtube.com/",
      isPartPath: (path) => path.startsWith("/shorts/"),
    }
  : host.endsWith("instagram.com")
  ? {
      siteKey: "instagram",
      partKey: "instagramReels",
      cssClass: "pf-hide-reels",
      home: "https://www.instagram.com/",
      // /reel/ID, /reels/, /username/reel/ID and /username/reels/
      isPartPath: (path) => /^\/([^/]+\/)?reels?\//.test(path),
    }
  : { siteKey: "x" }; // x.com and twitter.com have no sub-option

const BLOCKED_PAGE = chrome.runtime.getURL("blocked.html");

let settings = null; // null until loaded, so nothing is blocked by mistake

function check() {
  if (!settings) return;

  if (settings[SITE.siteKey]) {
    location.replace(BLOCKED_PAGE);
    return;
  }

  if (SITE.partKey) {
    const hideParts = settings[SITE.partKey];
    // content.css only hides things while this class is on <html>.
    document.documentElement.classList.toggle(SITE.cssClass, hideParts);
    if (hideParts && SITE.isPartPath(location.pathname)) {
      location.replace(SITE.home);
    }
  }
}

async function loadSettings() {
  settings = await chrome.storage.local.get(PF_DEFAULTS);
  check();
}

loadSettings();
chrome.storage.onChanged.addListener(loadSettings); // popup toggled something
window.addEventListener("pageshow", check); // page restored by Back/Forward
setInterval(check, 250); // catch in-app navigation
