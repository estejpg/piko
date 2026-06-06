# Piko Technical Handoff

This repo is the Chrome extension project for **Piko**:

<https://github.com/estejpg/piko>

Piko is a Manifest V3 Chrome extension for contextual media downloading on Instagram and YouTube. It currently supports Instagram posts, reels, carousels, profile-grid actions, profile multi-select, thumbnail mode, and YouTube thumbnail downloading on watch pages, home cards, and recommended videos.

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
  - Defines the message/event vocabulary used by the Instagram isolated content script and main-world bridge.
- `src/shared/settingsStore.js`
  - Central settings load, normalize, patch, and subscribe helper.
  - Uses `chrome.storage.local`.
  - This should remain the single source of truth for settings.
- `src/shared/filename.js`
  - Shared filename sanitization and pattern application.
  - Supports placeholders such as `{username}`, `{takenAt}`, `{id}`, `{type}`, and `{index}`.

### Download Flow

- `src/downloads/downloader.js`
  - Handles blob fetching, anchor downloads, File System Access folder selection, persisted directory handles, and bulk writes.
  - Exposes `downloadSingle`, `downloadBulk`, `saveBlobItem`, `chooseBulkDirectory`, and related helpers.
  - Bulk downloads use the File System Access API when available.
  - Single downloads try a saved directory handle first, then fall back to a normal browser download.

### Instagram Flow

- `src/content/mainWorldBridge.js`
  - Runs in the page context.
  - Bridges access to Instagram page/runtime data that isolated content scripts cannot safely access directly.
- `src/content/instagramContent.js`
  - Main Instagram controller.
  - Classifies routes, mounts/unmounts UI, coordinates settings, calls the resolver, and starts downloads.
  - Owns profile mode state and thumbnail mode state.
- `src/media/mediaResolver.js`
  - Normalizes Instagram media into downloadable item objects.
  - Handles post/reel/carousel/full-media and thumbnail targeting.
- `src/ui/ProfileSideMenu.js`
  - Compact profile dock with visible/profile/reels/folder/thumbnail actions.
- `src/ui/ProfileHoverButtons.js`
  - Profile grid hover download controls.
- `src/ui/ProfileMultiSelect.js`
  - Profile-only multi-select and selected-item action dock.
- `src/ui/TimelinePostActions.js`
  - Timeline and modal media hover download overlays.
- `src/ui/FeedTopButton.js`
  - Compact feed dock for current-post, folder, and settings actions.

### YouTube Flow

- `src/content/youtubeContent.js`
  - Detects YouTube watch pages and homepage routes.
  - Tracks YouTube SPA navigation.
  - Adds thumbnail download controls to:
    - current watch page
    - homepage video cards
    - recommended/sidebar video cards
  - Manages multi-select thumbnail state and batch downloading.
- `src/ui/YouTubeThumbnailControl.js`
  - Watch-page thumbnail button.
  - Card hover controls.
  - Bottom selected-thumbnails dock with previews.

### UI System

- `src/ui/icons.js`
  - Local inline SVG icon system.
  - Exposes `window.IgBulkIcons.icon(name)`.
- `src/ui/ToastHost.js`
  - Shared structured toast host with neutral/success/warning/error/progress states.
- `styles/content.css`
  - Content-page UI tokens and overlay styles for Instagram and YouTube surfaces.
- `styles/options.css`
  - Options page styling using the same product language.

Internal class names still use the historical `ig-bulk-*` namespace. That is implementation detail, not product branding. Avoid renaming it casually because it touches CSS, runtime selectors, and cleanup logic.

## Product Behavior To Preserve

- Instagram profile pages:
  - Compact profile dock appears only on profile-like pages.
  - Hover download buttons appear on media tiles.
  - Multi-select controls are profile-only and should not appear in the feed.
  - Selected tiles stay visibly selected after hover ends.
  - Thumbnail Mode changes selected/bulk targeting to thumbnails/posters.
- Instagram feed and modal views:
  - Download control is a media-area hover overlay, not injected into Instagram's native action row.
  - It should handle single images, videos/reels, and carousels.
  - Modal/lightbox post views should not duplicate feed controls.
- YouTube:
  - Watch pages expose a compact thumbnail download control.
  - Homepage and recommended cards expose hover controls.
  - Selected thumbnail dock appears only when one or more thumbnails are selected.
- Settings:
  - Folder/name/settings should flow through `settingsStore`.
  - Do not create surface-specific settings caches that can drift.

## Known Caveats

- Instagram private/internal data structures are brittle. Keep all page-context Instagram access contained behind `mainWorldBridge.js` and resolver fallbacks.
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
- Keep UI compact, contextual, and native-feeling. Avoid large panels, dashboards, or layout-shifting injections.

## Recommended Next Steps

1. Reload the unpacked extension from the repo root and smoke-test current behavior.
2. Manually verify Instagram:
   - feed image/video/carousel download
   - modal post/reel download
   - profile hover download
   - profile multi-select with mixed image/reel/carousel selections
   - thumbnail mode
3. Manually verify YouTube:
   - watch-page thumbnail download
   - homepage card thumbnail download/select
   - recommended/sidebar thumbnail download/select
   - selected-thumbnail dock preview and batch download
4. Add lightweight automated smoke tests if a build/test setup is introduced later.
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
