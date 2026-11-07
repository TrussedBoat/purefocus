# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PureFocus** is a content-blocking tool that keeps distracting websites, or only parts of them, from loading. The user picks what to block from a settings panel.

Current version: **0.2.0** (`extension/manifest.json`). It is a browser extension only. The DNS server idea (below) is not started.

## Current development context (2026-11-07)

- Active feature branch: `feature/youtube-recommendation-blocking`. Latest implementation commit: `0133a26` (event-driven sidebar updates).
- The recommendation controls and sidebar changes are not released. The manifest still says `0.2.0`; the existing `releases/purefocus-0.2.0.xpi` predates this work and must not be treated as a package of the feature branch.
- Last verified on 2026-11-06: nine Node tests and 225 browser fixture assertions passed. Fixtures exercise production CSS and real MutationObservers, but do not establish live YouTube compatibility or actual browser performance.
- The user reported slower YouTube browsing before the event-driven fix. Repeated visibility measurements were a plausible cause; no profiler capture proved causation, and the user has not yet confirmed improvement after the fix.
- Next step: reload the extension **and refresh existing YouTube tabs**, compare browsing performance, and check ordinary videos, playlists, live chat, end screens, theater/fullscreen, and in-app navigation in the target browsers. Wait for local validation before a version bump, packaging, or signing a new release.
- Local decision history is in `DESIGN-DECISIONS.local.md`, excluded using `.git/info/exclude`. If present, read it for rationale and append meaningful decisions. Keep it untracked and out of release archives; do not copy the private log into tracked docs.

## The Extension

Lives in `extension/`. Works in Chrome, Edge, Brave and Firefox 121+. Plain JavaScript, no build step, no dependencies.

### Options

Clicking the toolbar icon opens a panel with one switch per option. Switched on = blocked. Defaults live in `PF_DEFAULTS` in `settings.js`.

| Option | Blocks | Default |
|--------|--------|---------|
| YouTube | All of youtube.com and youtu.be | off |
| ↳ Shorts | `/shorts/` | on |
| ↳ Playables | `/playables` | on |
| ↳ Home feed | Homepage recommendations | on |
| ↳ Suggested videos | Watch-page recommendations beside/below the player | on |
| ↳ End-of-video suggestions | Player video/playlist end cards, recommendation grids and next-video overlays | on |
| Instagram | All of instagram.com | on |
| ↳ Reels | `/reel/`, `/reels/` | on |
| X (Twitter) | x.com and twitter.com | on |

A sub-option is part of its parent site. While the parent is blocked, the sub-option is shown on and locked, and its own saved value returns when the parent is turned off.

### How it works

Two layers enforce the settings, because neither is enough alone:

1. **Network rules** (`background.js`): rebuilds Chrome `declarativeNetRequest` dynamic rules from the saved settings every time one changes. Only acts when the browser loads a fresh page.
2. **Page script** (`content.js` + `content.css`): runs inside the blocked sites. Catches what the network rules miss: these sites are single-page apps (the URL changes without a page load), YouTube can serve itself from its own cache, and Back/Forward restores pages from memory. A fully blocked site is replaced by `blocked.html`. A blocked section is hidden with CSS and, if it has an `isPath` matcher, its URLs redirect to the site's home page. YouTube recommendation options only hide UI and never change autoplay or network rules.

The popup (`popup.html/css/js`) writes to `chrome.storage.local`. Both layers watch storage, so a change applies right away to open tabs.

### YouTube sidebar lifecycle and performance

`youtube-layout.js` keeps `#secondary` when a playlist, live chat, engagement panel, or content in a known auxiliary panel container is visible. Otherwise, Suggested videos blocking collapses it with CSS. Hidden placeholders do not count; DOM nodes are retained so YouTube can reuse them.

- `content.js` requests checks after settings load/change, DOM readiness, `yt-navigate-finish`, `pageshow`, and resize. Sidebar observation is active only on `/watch` while Suggested videos is blocked and the whole site is allowed.
- `pfCreateYoutubeLayoutWatcher` groups requests with `requestAnimationFrame`. Its panel observer filters visibility/content changes; its structure observer finds late or replacement columns. Before a watch-page shell exists, discovery temporarily observes document construction.
- Ignore recommendation-feed mutations and irrelevant decorative attributes. Disconnect observers while clearing/applying PureFocus's collapse class, then reattach, so our own updates cannot create a feedback loop. Disabling blocking or leaving the watch page disconnects observation.
- The 250 ms fallback compares only `location.href` on an unchanged page. **Do not restore repeated DOM scans or geometry measurements to that timer.** Different videos can share `/watch` and differ only in the query string.
- Visibility uses hidden/ARIA/engagement state, computed visibility, and element rectangles. Clear our collapse class synchronously before measuring so our own hiding does not conceal useful panels; finish before painting.
- YouTube markup can change. New panel containers may require updating the helper as well as `content.css`. Preserve playlists/chat rather than hiding the whole column unconditionally.

### Files

| File | Purpose |
|------|---------|
| `manifest.json` | Permissions, icons, scripts. Has both `service_worker` (Chrome) and `scripts` (Firefox) for the background, plus Firefox-only `browser_specific_settings` |
| `settings.js` | `PF_OPTIONS` (what the popup shows) and `PF_DEFAULTS`. Shared by the popup, background and content scripts |
| `background.js` | Turns settings into network rules (`buildRules`) |
| `content.js` | Per-site enforcement. `SITE` describes each site and its sub-parts |
| `youtube-layout.js` | Collapses the watch-page secondary column only when no useful panels are visible; updated on navigation/settings/resize and relevant sidebar mutations, with no idle layout polling |
| `content.css` | Hides Shorts, Playables, Reels and YouTube recommendations while the matching class is on `<html>` |
| `blocked.html` | Page shown when a whole site is blocked |
| `popup.*` | Settings panel |
| `icons/` | Extension icon at 16, 32, 48 and 128 px |
| `README.md` | User-facing install and usage steps, including Firefox |

### Adding a site or sub-option

1. Add it to `PF_OPTIONS` and `PF_DEFAULTS` in `settings.js`.
2. For URL blocking/redirects, add its rule to `buildRules` in `background.js`. CSS-only parts omit `isPath` and need no network rule.
3. Add its domain to `host_permissions`, `content_scripts.matches` and `web_accessible_resources.matches` in `manifest.json`, and describe it in `SITE` in `content.js`.
4. For a hideable section, add a `pf-hide-...` rule to `content.css`.

## Development

- **Run it**: Chrome: `chrome://extensions` → Developer mode → Load unpacked → pick `extension/`. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → pick `manifest.json`. Reload the extension and refresh existing affected-site tabs after edits so old content scripts are replaced.
- **Build / install deps / linter**: none. Node 18+ is only a development test tool, not an extension dependency.
- **Tests**: from the root, run `node tests/extension.test.cjs` for mocked browser-API tests. Open `tests/preview.html` in Firefox/Chromium for visual toggles and browser assertions using the production stylesheet and sidebar visibility helper. The extension README describes live YouTube checks; fixtures alone cannot verify current YouTube markup.
- **Package for Firefox**: `cd extension && zip -r ../purefocus.zip . -x '.*'` (`manifest.json` must be at the zip's top level).

## Releasing (Firefox)

Complete local feature and performance checks first. Package only the contents of `extension/`, never the repository root; tests and local decision notes must not enter the archive.

Signed through addons.mozilla.org as an **unlisted** add-on (free, not shown on the store). Regular Firefox only keeps signed add-ons, and `xpinstall.signatures.required` is ignored outside Developer Edition and Nightly.

1. Raise `"version"` in `manifest.json`. AMO rejects a version it has already signed.
2. Zip as above and upload on the AMO Developer Hub → Submit a New Version (unlisted, "On your own").
3. Open the version's page, download the signed `.xpi`, and keep it as `releases/purefocus-<version>.xpi`.
4. In Firefox: `about:addons` → gear → Install Add-on From File.

The add-on ID `purefocus@aligorkem` is fixed by the first upload. Never change it. There is no `update_url`, so installed copies never update themselves.

## Conventions and Gotchas

- Everything about a setting's name lives in `settings.js`. Do not hard-code option keys elsewhere without also updating it.
- The CSS selectors for Shorts, Playables, Reels and YouTube recommendations depend on each site's internal markup and break when the sites change. Fix them in `content.css`. Instagram's feed is the least reliable.
- The sidebar entry and channel tab for Shorts match the English word "Shorts", so they stay visible if YouTube is in another language.
- Network rules affect only the next page load. The page script handles tabs that are already open.

## TODO

- [ ] Publish on the Chrome Web Store (unlisted), if wanted for Chrome without developer mode.
- [ ] **Lock mechanism**, so a block is not a one-click bypass. Two kinds, possibly combined:
  - [ ] **Time lock**: lock a switch (or the whole panel) until a chosen date/time, or for a chosen duration. Lowering a block is refused until it expires. Store the unlock time as an absolute timestamp in `chrome.storage`, and compare against the clock when a change is requested.
  - [ ] **Password lock**: the user sets a password; turning a switch off, or editing the lock, asks for it. Store only a salted hash (e.g. PBKDF2 via `crypto.subtle`), never the password.
  - [ ] Enforce the lock where settings are written, not just in the popup UI (for example in `background.js`, rejecting writes that lower a block while locked), since content and popup scripts can both write to storage.
  - [ ] Decide what a lock covers: all switches, or per-site. Raising a block (turning a switch on) should always be allowed.
  - [ ] Decide how to handle the escape hatches: uninstalling or disabling the extension, and a forgotten password. Chrome can force-install and lock an extension via enterprise policy; Firefox has no equivalent, so some bypass will always exist.
  - [ ] Show lock state in the popup (locked until..., password required) and add a way to set/change the lock.
- [ ] Support other languages for the Shorts sidebar entry and channel tab.
- [ ] Let the user add their own sites from the panel instead of editing code.
