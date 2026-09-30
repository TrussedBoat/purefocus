// Runs on YouTube and Instagram and removes their short-video sections
// (Shorts, Reels) when the matching option is on.
//
// Both sites are single-page apps: clicking a link changes the URL without
// loading a new page, so the network rules in background.js never see it.
// That's why the URL is also checked here.

const SITE = location.hostname.endsWith("youtube.com")
  ? {
      key: "youtubeShorts",
      cssClass: "pf-hide-shorts",
      home: "https://www.youtube.com/",
      isBlocked: (path) => path.startsWith("/shorts/"),
    }
  : {
      key: "instagramReels",
      cssClass: "pf-hide-reels",
      home: "https://www.instagram.com/",
      // /reel/ID, /reels/, /username/reel/ID and /username/reels/
      isBlocked: (path) => /^\/([^/]+\/)?reels?\//.test(path),
    };

let enabled = PF_DEFAULTS[SITE.key];

function check() {
  // content.css only hides things while this class is on <html>.
  document.documentElement.classList.toggle(SITE.cssClass, enabled);
  if (enabled && SITE.isBlocked(location.pathname)) {
    location.replace(SITE.home);
  }
}

async function loadSettings() {
  const settings = await chrome.storage.local.get(PF_DEFAULTS);
  enabled = settings[SITE.key];
  check();
}

loadSettings();
chrome.storage.onChanged.addListener(loadSettings); // popup toggled something
setInterval(check, 250); // catch in-app navigation
