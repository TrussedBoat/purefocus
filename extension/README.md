# PureFocus browser extension

Blocks distracting sites, or only their short-video sections. Click the extension's toolbar icon to choose what's blocked:

| Option | When on |
|--------|---------|
| YouTube | All of YouTube is blocked |
| ↳ Shorts | Shorts are hidden and Shorts links go to the YouTube home page |
| ↳ Playables | YouTube's games section is hidden and Playables links go to the YouTube home page |
| Instagram | All of Instagram is blocked |
| ↳ Reels | Reels are hidden and Reels links go to the Instagram home page |
| X (Twitter) | x.com and twitter.com are blocked |

While a site is blocked, its sub-option is locked on, because it's already covered. Its own setting comes back when you unblock the site.

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
| `content.css` | Hides Shorts/Reels shelves, feed items and navigation links |
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
3. `content.js` notices in tabs that are already open. It sends a blocked site's tab to `blocked.html`, and hides or shows Shorts/Reels, right away.

## Adding a site

1. Add an entry to `PF_OPTIONS` and `PF_DEFAULTS` in `settings.js`.
2. Add its rule to `buildRules` in `background.js`.
3. Add its domain to `host_permissions`, `content_scripts.matches` and `web_accessible_resources.matches` in `manifest.json`, and to `SITE` in `content.js`.
