# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PureFocus** is a content-blocking tool that keeps distracting websites, or only parts of them, from loading. The user picks what to block from a settings panel.

Current version: **0.2.0** (`extension/manifest.json`). It is a browser extension only. The DNS server idea (below) is not started.

## The Extension

Lives in `extension/`. Works in Chrome, Edge, Brave and Firefox 121+. Plain JavaScript, no build step, no dependencies.

### Options

Clicking the toolbar icon opens a panel with one switch per option. Switched on = blocked. Defaults live in `PF_DEFAULTS` in `settings.js`.

| Option | Blocks | Default |
|--------|--------|---------|
| YouTube | All of youtube.com and youtu.be | off |
| ↳ Shorts | `/shorts/` | on |
| ↳ Playables | `/playables` | on |
| Instagram | All of instagram.com | on |
| ↳ Reels | `/reel/`, `/reels/` | on |
| X (Twitter) | x.com and twitter.com | on |

A sub-option is part of its parent site. While the parent is blocked, the sub-option is shown on and locked, and its own saved value returns when the parent is turned off.

### How it works

Two layers enforce the settings, because neither is enough alone:

1. **Network rules** (`background.js`): rebuilds Chrome `declarativeNetRequest` dynamic rules from the saved settings every time one changes. Only acts when the browser loads a fresh page.
2. **Page script** (`content.js` + `content.css`): runs inside the blocked sites. Catches what the network rules miss: these sites are single-page apps (the URL changes without a page load), YouTube can serve itself from its own cache, and Back/Forward restores pages from memory. A fully blocked site is replaced by `blocked.html`. A blocked section is hidden with CSS and its URLs redirect to the site's home page.

The popup (`popup.html/css/js`) writes to `chrome.storage.local`. Both layers watch storage, so a change applies right away to open tabs.

### Files

| File | Purpose |
|------|---------|
| `manifest.json` | Permissions, icons, scripts. Has both `service_worker` (Chrome) and `scripts` (Firefox) for the background, plus Firefox-only `browser_specific_settings` |
| `settings.js` | `PF_OPTIONS` (what the popup shows) and `PF_DEFAULTS`. Shared by the popup, background and content scripts |
| `background.js` | Turns settings into network rules (`buildRules`) |
| `content.js` | Per-site enforcement. `SITE` describes each site and its sub-parts |
| `content.css` | Hides Shorts, Playables and Reels while the matching class is on `<html>` |
| `blocked.html` | Page shown when a whole site is blocked |
| `popup.*` | Settings panel |
| `icons/` | Extension icon at 16, 32, 48 and 128 px |
| `README.md` | User-facing install and usage steps, including Firefox |

### Adding a site or sub-option

1. Add it to `PF_OPTIONS` and `PF_DEFAULTS` in `settings.js`.
2. Add its rule to `buildRules` in `background.js`.
3. Add its domain to `host_permissions`, `content_scripts.matches` and `web_accessible_resources.matches` in `manifest.json`, and describe it in `SITE` in `content.js`.
4. For a hideable section, add a `pf-hide-...` rule to `content.css`.

## Development

- **Run it**: Chrome: `chrome://extensions` → Developer mode → Load unpacked → pick `extension/`. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → pick `manifest.json`. Reload the extension after every edit.
- **Build / install deps / tests / linter**: none exist. The scripts use `chrome.*` APIs, so they only run inside a browser. For a quick check, serve `extension/` with `python3 -m http.server` and fake `chrome.storage`.
- **Package for Firefox**: `cd extension && zip -r ../purefocus.zip . -x '.*'` (`manifest.json` must be at the zip's top level).

## Releasing (Firefox)

Signed through addons.mozilla.org as an **unlisted** add-on (free, not shown on the store). Regular Firefox only keeps signed add-ons, and `xpinstall.signatures.required` is ignored outside Developer Edition and Nightly.

1. Raise `"version"` in `manifest.json`. AMO rejects a version it has already signed.
2. Zip as above and upload on the AMO Developer Hub → Submit a New Version (unlisted, "On your own").
3. Open the version's page, download the signed `.xpi`, and keep it as `releases/purefocus-<version>.xpi`.
4. In Firefox: `about:addons` → gear → Install Add-on From File.

The add-on ID `purefocus@aligorkem` is fixed by the first upload. Never change it. There is no `update_url`, so installed copies never update themselves.

## Conventions and Gotchas

- Everything about a setting's name lives in `settings.js`. Do not hard-code option keys elsewhere without also updating it.
- The CSS selectors for Shorts, Playables and Reels depend on each site's internal markup and break when the sites change. Fix them in `content.css`. Instagram's feed is the least reliable.
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
