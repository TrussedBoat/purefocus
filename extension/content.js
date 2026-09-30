// Runs on every site PureFocus handles and enforces the settings from inside
// the page.
//
// The network rules in background.js only act when the browser loads a new
// page. They miss a lot: these sites are single-page apps (clicking a link
// changes the URL without loading a page), YouTube can serve itself from its
// own offline cache, and Back/Forward can restore a page from memory. This
// script catches all of those by checking the settings and the URL itself.

// Each part is a sub-option: while its setting is on, content.css hides it
// (via cssClass on <html>) and URLs matching isPath go to the site's home.
const host = location.hostname;
const SITE = host.endsWith("youtube.com")
  ? {
      siteKey: "youtube",
      home: "https://www.youtube.com/",
      parts: [
        {
          key: "youtubeShorts",
          cssClass: "pf-hide-shorts",
          isPath: (path) => path.startsWith("/shorts/"),
        },
        {
          key: "youtubePlayables",
          cssClass: "pf-hide-playables",
          isPath: (path) => path === "/playables" || path.startsWith("/playables/"),
        },
      ],
    }
  : host.endsWith("instagram.com")
  ? {
      siteKey: "instagram",
      home: "https://www.instagram.com/",
      parts: [
        {
          key: "instagramReels",
          cssClass: "pf-hide-reels",
          // /reel/ID, /reels/, /username/reel/ID and /username/reels/
          isPath: (path) => /^\/([^/]+\/)?reels?\//.test(path),
        },
      ],
    }
  : { siteKey: "x", parts: [] }; // x.com and twitter.com have no sub-options

const BLOCKED_PAGE = chrome.runtime.getURL("blocked.html");

let settings = null; // null until loaded, so nothing is blocked by mistake

function check() {
  if (!settings) return;

  if (settings[SITE.siteKey]) {
    location.replace(BLOCKED_PAGE);
    return;
  }

  for (const part of SITE.parts) {
    const hide = settings[part.key];
    document.documentElement.classList.toggle(part.cssClass, hide);
    if (hide && part.isPath(location.pathname)) {
      location.replace(SITE.home);
      return;
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
