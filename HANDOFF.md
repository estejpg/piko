# Piko Technical Handoff

This repo is the Chrome extension project for **Piko**:

<https://github.com/estejpg/piko>

Piko is a Manifest V3 Chrome extension for contextual media downloading on Instagram and YouTube. It supports Instagram posts, reels, carousels, modals, profile-grid actions, Select mode, and full-profile bulk downloads, plus YouTube thumbnails, transcripts, selection, and batch downloads across watch and listing routes.

## Current Repo State

- The old `Instagram-Bulk-Downloader-MVP` folder has already been removed locally.
- The extension files now live at the repository root.
- The extension has been renamed to **Piko** in the visible manifest/options labels.
- The repo root is intentionally simple:
  - `manifest.json`
  - `README.md`
  - `LICENSE`
  - `.gitignore`
  - `options.html`
  - `popup.html`
  - `src/`
  - `styles/`
  - `references/extension-references/`
- There is no build pipeline, package manager setup, or bundler. The extension is plain JavaScript loaded directly by `manifest.json`.

Do not reintroduce the old wrapper folder unless there is a strong packaging reason. Chrome should load the repository root as the unpacked extension.

The `references/extension-references/` folder is intentionally separate from the extension source. It contains third-party unpacked Chrome extensions for Cursor/cloud-agent study only. Do not import, bundle, copy, or execute reference code as part of Piko.

## How To Run Locally

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository root folder.
6. Reload the extension after code changes.

## Validation Commands

Run these before handing off changes:

```sh
for f in $(find . -path ./.git -prune -o -name '*.js' -print | sort); do
  node --check "$f" || exit 1
done
```

```sh
node - <<'NODE'
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const missing = [];
function check(path) {
  if (!fs.existsSync(path)) missing.push(path);
}
if (manifest.options_page) check(manifest.options_page);
if (manifest.background?.service_worker) check(manifest.background.service_worker);
for (const script of manifest.content_scripts || []) {
  for (const js of script.js || []) check(js);
  for (const css of script.css || []) check(css);
}
console.log(JSON.stringify({
  name: manifest.name,
  short_name: manifest.short_name,
  version: manifest.version,
  missing
}, null, 2));
if (missing.length) process.exit(1);
NODE
```

## Manifest Overview

`manifest.json` defines:

- MV3 extension name: `Piko`
- Permissions: `storage`
- Hosts:
  - Instagram pages and CDN hosts
  - YouTube web pages
  - `i.ytimg.com` for YouTube thumbnails
- Options page: `options.html`
- Toolbar popup: `popup.html`
- Background service worker: `src/background/serviceWorker.js`
- Instagram content scripts:
  - `src/content/mainWorldBridge.js` in the page `MAIN` world at `document_start`
  - isolated-world content stack at `document_idle`
- YouTube content scripts:
  - shared settings/filename/downloader utilities
  - shared icons/toasts
  - YouTube thumbnail UI and content controller

Keep manifest-listed file paths relative to the repo root.

## Architecture

### Shared Modules

- `src/shared/messages.js`
  - Defines the small message/event vocabulary (bridge route-change events, undo).
  - Also hosts `IG_BULK_FILENAME_PRESETS` and `IG_BULK_DEFAULT_SETTINGS`.
- `src/shared/settingsStore.js`
  - Central settings load, normalize, patch, and subscribe helper.
  - Uses `chrome.storage.local`.
  - This should remain the single source of truth for settings.
  - Current fields include `filenamePattern`, `filenamePreset`, `showFeedButton`, `selectedFolderName`, `lastUiMode`, `showReliabilityToasts`, and `enableKeyboardShortcuts`.
- `src/shared/filename.js`
  - Shared filename sanitization and pattern application.
  - Supports placeholders such as `{username}`, `{takenAt}`, `{id}`, `{type}`, and `{index}`.
- `src/shared/downloadHistory.js`
  - Records recent downloads, exposes list/clear/getLastBatch, and supports undoing the last folder batch via the downloader directory handle.
- `src/shared/shortcuts.js`
  - Optional page keyboard shortcuts (S save current, A toggle Select), ignored while typing.

### Download Flow

- `src/downloads/downloader.js`
  - Handles blob fetching, anchor downloads, File System Access folder selection, persisted directory handles, and bulk writes.
  - Exposes `downloadSingle`, `downloadBulk`, `saveBlobItem`, `chooseBulkDirectory`, and related helpers.
  - Bulk downloads use the File System Access API when available.
  - Single downloads try a saved directory handle first, then fall back to a normal browser download.

### Instagram Flow

The Instagram backend follows the Turbo Downloader model: all media resolution
happens in the isolated content script against Instagram's own web REST API,
and the main-world script is reduced to a slim helper.

- `src/content/mainWorldBridge.js`
  - Runs in the page context.
  - Stashes the web API headers (`x-ig-app-id`, `x-ig-www-claim`) in
    sessionStorage, which the isolated content script shares.
  - Patches the History API to emit SPA route-change events.
  - Tags rendered media with their numeric media id (from React fiber props)
    via `data-ig-bulk-media-id` for feed/reels items without permalinks.
  - No longer serves media data over an RPC bridge.
- `src/media/mediaResolver.js`
  - Decodes the numeric media id straight from a shortcode (base64 math, no
    network, no page-runtime dependency).
  - Calls Instagram's REST web API with credentials plus the stashed headers:
    - `/api/v1/media/{id}/info/` for posts, reels, and carousels
    - `/api/v1/users/web_profile_info/` for user id and post count
    - `/api/v1/feed/user/{username}/username/` (paginated) for full-profile bulk
    - `/api/v1/feed/reels_media/` for stories and highlights
  - Normalizes API payloads into downloadable item objects (always full media:
    photos, videos, and every carousel child at the highest resolution).
  - Surfaces HTTP 429 as a typed rate-limit error and keeps DOM collection
    helpers as the last-resort fallback.
- `src/content/instagramContent.js`
  - Main Instagram controller.
  - Classifies routes (including `/reels/{code}`), mounts/unmounts UI,
    coordinates settings, calls the resolver, and starts downloads.
  - Resolution order everywhere: shortcode API, marked media-id API, DOM.
- `src/ui/ProfileSideMenu.js`
  - Site-derived bottom menu with visible/profile/select/folder actions.
- `src/ui/ProfileHoverButtons.js`
  - Profile grid hover download controls.
- `src/ui/ProfileMultiSelect.js`
  - Mode-gated profile/Explore selection controls and the selected-item bottom menu.
- `src/ui/TimelinePostActions.js`
  - Timeline and modal media hover download overlays.
- `src/ui/FeedTopButton.js`
  - Compact bottom page menu for current-post, Select where supported, folder, and settings actions.
- `src/ui/StoryViewerActions.js`
  - Compact bottom menu on `/stories/...` for current item, full reel, and folder.

There is no thumbnail mode and no reels-only bulk mode. Bulk downloads always
download everything.

### YouTube Flow

- `src/content/youtubeContent.js`
  - Detects YouTube watch pages and homepage routes.
  - Tracks YouTube SPA navigation.
  - Adds thumbnail download controls to:
    - current watch page
    - homepage video cards
    - recommended/sidebar video cards
  - Scopes watch-page placement to visible `ytd-watch-metadata` actions.
  - Manages explicit Select mode and batch downloading.
- `src/ui/YouTubeThumbnailControl.js`
  - Watch-page thumbnail button.
  - Direct thumbnail-surface controls.
  - YouTube page menu.
  - Bottom selected-thumbnails menu with previews.

### Popup Flow

- `popup.html`
- `src/popup/popup.js`
- `styles/popup.css`
  - Reports whether the active page is supported.
  - Shows the remembered folder.
  - Lists recent downloads with undo-last-batch and clear-history actions.
  - Opens settings, Instagram, or YouTube.
  - Remains secondary to the on-page experience.

### Smoke Scripts

- `scripts/smoke.mjs`
  - Manifest path checks plus filename preset/`applyPattern` smoke coverage via `node:vm`.
- `scripts/smoke-history.mjs`
  - Download-history record/list/getLastBatch roundtrip against a mocked `chrome.storage.local`.
- `scripts/smoke-instagram.mjs`
  - Instagram resolver coverage: shortcode/media-id math, REST payload normalization, URL and story-route parsing.
- `scripts/smoke-youtube-transcript.mjs`
  - YouTube transcript regression coverage: chapter panels are rejected, modern targetless transcript panels are accepted, and spoken row text excludes timestamp accessibility labels.

### UI System

- `src/ui/icons.js`
  - Local inline SVG icon system.
  - Exposes `window.IgBulkIcons.icon(name)`.
- `src/ui/ToastHost.js`
  - Shared structured toast host with neutral/success/warning/error/progress states.
- `styles/content.css`
  - Shared site-derived tokens, bottom menus, overlays, selection states, and toasts.
- `styles/options.css`
  - Options page styling using the same product language.

Internal class names still use the historical `ig-bulk-*` namespace. That is implementation detail, not product branding. Avoid renaming it casually because it touches CSS, runtime selectors, and cleanup logic.

## Product Behavior To Preserve

- Instagram profile pages:
  - Compact bottom menu appears only on profile-like pages.
  - Direct download buttons appear on media tiles without depending on selection mode.
  - Selection controls appear only after Select mode is activated.
  - Selected tiles stay visibly selected after hover ends.
  - Profile bulk paginates the profile feed API and downloads everything.
  - Selected-item previews, count, Download, Clear, and progress live in a temporary bottom menu.
- Instagram feed and modal views:
  - Download control is a media-area overlay on the media itself, not injected into Instagram's native action row.
  - It should handle single images, videos/reels, and carousels.
  - Modal/lightbox post views should not duplicate feed controls behind the dialog, and the overlay must stay on the media surface so it remains clickable.
- Instagram Explore:
  - Page menu exposes Current, Select, folder, and settings.
  - Grid tiles keep direct download and Select-mode controls.
- YouTube:
  - Watch pages expose compact Thumbnail and Transcript controls beside the visible native action area.
  - On watch pages, the bottom Select/Settings rail appears only after scrolling past `#description`, and hides again when scrolling back up.
  - Homepage, search, subscriptions, channel, and recommended cards expose a direct thumbnail control.
  - Selection affordances appear only during Select mode.
  - The batch menu remains visible during Select mode, including its empty, progress, and completion states.
- Settings:
  - Folder/name/settings should flow through `settingsStore`.
  - Do not create surface-specific settings caches that can drift.
- Instagram Stories are supported in the open story viewer via the REST `reels_media` endpoint (user id from `web_profile_info`) with DOM fallback for the current slide. Highlights use `highlight:{id}` reel ids.

## Known Caveats

- Instagram media resolution now uses the documented-in-practice web REST API rather than private page-runtime internals. The only page-context dependencies left are the header stash and fiber-id marking in `mainWorldBridge.js`, and both have fallbacks (a public web app id constant; shortcode decoding needs no page data at all).
- Instagram returns HTTP 429 when rate limited. The resolver surfaces this as a typed error and the controller shows a dedicated toast; bulk flows stop early instead of hammering the API.
- Selected profile tiles and per-post resolution fall back to the media already rendered inside their matching tile when the API returns nothing.
- Instagram and YouTube are SPAs. Any UI injection must be idempotent, route-aware, and cleaned up on navigation.
- Avoid heavy MutationObserver work on scrolling grids. Throttle/debounce DOM scans and prefer adding one small overlay per stable media container.
- Persisted File System Access handles may behave differently across page origins. The downloader already falls back to browser downloads when a saved handle is unavailable or stale.
- Live download QA requires being logged into Instagram/YouTube in Chrome and reloading the unpacked extension.

## Safe Development Guidelines

- Keep the no-build plain JS structure unless a future task explicitly asks for tooling.
- Use `apply_patch` or normal source edits; avoid generated bundle churn.
- After moving files, always validate manifest-listed paths.
- Do not copy code from the reference extensions that were previously in the workspace. They were used only as architectural inspiration.
- Treat `references/extension-references/` as read-only reference material and keep implementation work in Piko's own modules.
- Prefer extending existing modules over adding parallel flows:
  - Media resolution belongs in `src/media/mediaResolver.js`.
  - File saving belongs in `src/downloads/downloader.js`.
  - Settings belong in `src/shared/settingsStore.js`.
  - Filename behavior belongs in `src/shared/filename.js`.
- Keep UI compact, contextual, and native-feeling. Preserve the shared bottom-menu structure and avoid large panels, dashboards, or layout-shifting injections.

## Recommended Next Steps

1. Reload the unpacked extension from the repo root and smoke-test current behavior.
2. Manually verify Instagram:
   - feed image/video/carousel download
   - modal post/reel download
   - profile hover download
   - profile multi-select with mixed image/reel/carousel selections
   - full-profile bulk download (Profile action)
3. Manually verify YouTube:
   - watch-page thumbnail download
   - watch-page transcript download
   - homepage card thumbnail download/select
   - recommended/sidebar thumbnail download/select
   - selected-thumbnail dock preview and batch download
4. Run `node scripts/smoke.mjs`, `node scripts/smoke-history.mjs`, `node scripts/smoke-instagram.mjs`, and `node scripts/smoke-youtube-transcript.mjs` after shared-module, resolver, or transcript changes.
5. Consider adding extension icons/assets before Chrome Web Store packaging.

## Git Notes

The cleanup/rename commit was pushed to `origin/main`:

```sh
9f3b525 Rename MVP extension to Piko and clean repository
```

Before starting new work, run:

```sh
git status --short --branch
git pull --ff-only origin main
```
