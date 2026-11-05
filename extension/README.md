# PureFocus browser extension

Blocks distracting sites, short-video sections, and YouTube recommendations. Click the extension's toolbar icon to choose what's blocked:

| Option | When on |
|--------|---------|
| YouTube | All of YouTube is blocked |
| ↳ Shorts | Shorts are hidden and Shorts links go to the YouTube home page |
| ↳ Playables | YouTube's games section is hidden and Playables links go to the YouTube home page |
| ↳ Home feed | Recommended videos on the YouTube homepage are hidden |
| ↳ Suggested videos | Recommendations beside or below the watch-page player are hidden |
| ↳ End-of-video suggestions | Player recommendation grids, video/playlist end cards, and next-video overlays are hidden |
| Instagram | All of Instagram is blocked |
| ↳ Reels | Reels are hidden and Reels links go to the Instagram home page |
| X (Twitter) | x.com and twitter.com are blocked |

While a site is blocked, its sub-option is locked on, because it's already covered. Its own setting comes back when you unblock the site.

The three recommendation switches default to blocked, including when upgrading an existing installation. Search, subscriptions, channel videos, playlist queues, live chat, and player controls remain available. Turning a switch off restores the hidden area.

**Autoplay is separate.** Hiding suggestions does not stop YouTube from automatically playing another video. Turn autoplay off in YouTube if you want playback to stop. Creator subscribe buttons and external-link end cards remain visible. These options target desktop YouTube and hide UI; they do not prevent recommendation data from downloading.

## Install (Chrome, Edge, Brave)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Pin PureFocus from the puzzle-piece menu so its icon stays in the toolbar.

After editing any file, click the reload icon on the extension's card.

## Install (Firefox 121 or newer)

Firefox only installs signed add-ons permanently. While developing, you load PureFocus as a **temporary add-on** from the debugging page instead.

1. Type `about:debugging` in the address bar and press Enter.
2. In the left sidebar, click **This Firefox**.
3. Under **Temporary Extensions**, click **Load Temporary Add-on…**.
4. In the file picker, open this `extension/` folder and select `manifest.json`.

PureFocus now appears under **Temporary Extensions**. To put its icon in the toolbar, click the puzzle-piece (Extensions) button, then the gear next to PureFocus, and choose **Pin to Toolbar**.

**Allow it on the blocked sites.** Firefox may not grant site access straight away. If a blocked site or Shorts/Reels still show:

1. Open `about:addons` and click **PureFocus**.
2. Open the **Permissions** tab.
3. Turn on access for `youtube.com`, `instagram.com`, `x.com` and `twitter.com`.

**Things to know about temporary add-ons**
- It's removed when Firefox closes. Repeat the steps after each restart. Your switch settings are kept, because the add-on has a fixed ID.
- After editing a file, click **Reload** on its card in `about:debugging`.
- If something doesn't work, click **Inspect** on the card to open the add-on's console and see its errors.

To install it permanently, it has to be signed through [addons.mozilla.org](https://addons.mozilla.org/developers/). You can sign it for your own use without publishing it on the store.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Declares permissions and wires the files together |
| `settings.js` | The list of options and their defaults, shared by the other scripts |
| `popup.html`, `popup.css`, `popup.js` | The settings panel that opens from the toolbar icon |
| `background.js` | Turns the settings into Chrome blocking and redirect rules |
| `content.js` | Runs inside the blocked sites and enforces the settings there, including navigation the network rules miss |
| `blocked.html` | The page shown when a blocked site is caught inside the page |
| `content.css` | Hides blocked sections and YouTube recommendation surfaces |
| `icons/` | The extension's icon at 16, 32, 48 and 128 px (currently a placeholder) |

## Changing the icon

Replace the four files in `icons/` with your own, keeping the same names and sizes:

| File | Size (px) | Where it shows |
|------|-----------|----------------|
| `icon-16.png` | 16 × 16 | Toolbar button |
| `icon-32.png` | 32 × 32 | Toolbar button on high-resolution screens |
| `icon-48.png` | 48 × 48 | Extensions page |
| `icon-128.png` | 128 × 128 | Install dialog and web store |

- Use PNG with a transparent background.
- If you only have one large image, you can use it for all four. The browser scales it, but small sizes look sharper when made at that size.
- A new icon only appears after you reload the extension.

## How a setting change flows

1. You flip a switch, and `popup.js` saves it to `chrome.storage`.
2. `background.js` notices and rebuilds the network rules. This affects the next page you open.
3. `content.js` notices in tabs that are already open. It sends a blocked site's tab to `blocked.html`, and hides or shows blocked sections and recommendations right away.

## Adding a site

1. Add an entry to `PF_OPTIONS` and `PF_DEFAULTS` in `settings.js`.
2. For URL blocking or redirects, add its rule to `buildRules` in `background.js`. Presentation-only options need no network rule.
3. Add its domain to `host_permissions`, `content_scripts.matches` and `web_accessible_resources.matches` in `manifest.json`, and to `SITE` in `content.js`.

## Tests and visual preview

The extension still has no build step or runtime dependencies. Node is only used to run development tests.

From the repository root, with Node 18 or newer installed, run:

```sh
node tests/extension.test.cjs
```

This checks defaults, saved choices, independent switching, navigation callbacks, parent/child popup behavior, existing redirects, and unchanged network rules using mocked browser APIs.

For a visual check, open `tests/preview.html` in Firefox or Chromium. No Node, extension installation, or server is required. The page loads the production stylesheet, provides three switches, and automatically runs 192 computed-style assertions across all eight combinations. Green samples must remain visible; yellow recommendation samples disappear when their switch is on. Click **Run browser assertions** to repeat the checks. The preview never changes your extension settings.

You can also serve the repository root with `python3 -m http.server 8765 --bind 127.0.0.1` and open `http://127.0.0.1:8765/tests/preview.html`.

### Live YouTube checks

Fixtures check CSS behavior against representative markup; they cannot detect YouTube changing its HTML. After updating selectors, reload the extension and verify desktop YouTube in Chromium and Firefox:

- Toggle each setting independently and together. Check direct loads, in-app navigation, Back/Forward, and content appearing after page load.
- Check the homepage, search, subscriptions, channel videos, ordinary watch pages, playlists, and live chat. Only the selected recommendation surfaces should disappear.
- Check player end cards and post-play suggestions in normal, theater, and fullscreen modes, with autoplay both enabled and disabled. Controls, captions, subscribe buttons, and external links should remain usable; playback behavior should be unchanged.
- Block and unblock all of YouTube. Child switches must lock on while covered, then return to their saved preferences.

Keep selector fixes in `content.css`, and update the fixtures to represent any new markup variant.
