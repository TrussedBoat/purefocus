// Turns the saved settings into Chrome's network blocking rules, and rebuilds
// them whenever the popup changes a setting.

// Chrome runs this file as a service worker (the "service_worker" key in
// manifest.json) and it loads settings.js itself. Firefox uses the "scripts"
// key instead, which loads settings.js first and has no importScripts.
if (typeof importScripts === "function") {
  importScripts("settings.js");
}

const PAGE_LOADS = ["main_frame", "sub_frame"];

function buildRules(settings) {
  const rules = [];

  function block(domain) {
    rules.push({
      id: rules.length + 1,
      priority: 1,
      action: { type: "block" },
      condition: { urlFilter: "||" + domain, resourceTypes: PAGE_LOADS },
    });
  }

  function redirect(urlFilter, to) {
    rules.push({
      id: rules.length + 1,
      priority: 1,
      action: { type: "redirect", redirect: { url: to } },
      condition: { urlFilter, resourceTypes: ["main_frame"] },
    });
  }

  // A blocked parent already covers its child, so the child rule is skipped.
  if (settings.youtube) {
    block("youtube.com");
    block("youtu.be");
  } else if (settings.youtubeShorts) {
    redirect("||youtube.com/shorts/", "https://www.youtube.com/");
  }

  if (settings.instagram) {
    block("instagram.com");
  } else if (settings.instagramReels) {
    redirect("||instagram.com/reel/", "https://www.instagram.com/");
    redirect("||instagram.com/reels/", "https://www.instagram.com/");
  }

  if (settings.x) {
    block("x.com");
    block("twitter.com");
  }

  return rules;
}

async function syncRules() {
  const settings = await chrome.storage.local.get(PF_DEFAULTS);
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRules.map((rule) => rule.id),
    addRules: buildRules(settings),
  });
}

// Run one sync at a time, so quick toggles can't interleave and collide on rule ids.
let queue = Promise.resolve();
function scheduleSync() {
  queue = queue.then(syncRules).catch((err) => console.error("PureFocus: rule update failed", err));
}

chrome.runtime.onInstalled.addListener(scheduleSync);
chrome.runtime.onStartup.addListener(scheduleSync);
chrome.storage.onChanged.addListener(scheduleSync);
