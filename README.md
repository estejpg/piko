# Piko

Piko is a lightweight Chrome extension for saving Instagram media, YouTube thumbnails, and YouTube transcripts from contextual controls that live directly on each site.

## Features

- Download Instagram feed posts, reels, modal media, single images, and ordered carousels.
- Download visible profile media, profile media, reels, grid items, or thumbnails.
- Enter Select mode only when needed, preview selected items, and run bulk downloads from the shared bottom menu.
- Save YouTube thumbnails from watch pages, home, search, subscriptions, channel listings, and recommendations.
- Download clean text transcripts beside YouTube’s native watch-page actions.
- Keep filename and folder preferences shared across every supported surface.

## Interaction Model

Piko is on-page first. The extension popup reports page status and links to settings, Instagram, and YouTube, but it does not replace the controls on the host site.

### Instagram

- Posts, reels, carousels, and modal media receive a compact media-level download action.
- Profile and Explore grid tiles receive a direct download action.
- Profile pages use a bottom menu for visible media, profile media, reels, thumbnail mode, Select mode, and folder access.
- The feed uses a smaller page menu for the current item, folder, and settings.
- Select mode temporarily replaces the page menu with previews, a count, Download, Clear, progress, and completion state.
- High-quality private resolution remains the first choice. When Instagram’s internals do not return media, Piko falls back to media already present in the relevant DOM surface.

### YouTube

- Watch-page Thumbnail and Transcript actions mount only in a visible `ytd-watch-metadata` action area.
- Listing controls mount directly on thumbnail surfaces and remain independently reachable when YouTube renders inline previews.
- Select mode reveals per-thumbnail selection controls and temporarily replaces the page menu with the shared batch-download menu.
- Route changes and infinite-scroll scans reuse or move existing controls instead of duplicating them.

## Visual System

The UI adapts the editorial language of `estejpg/estejpg-site`:

- system/Inter typography;
- true white and near-black surfaces;
- restrained monochrome hierarchy;
- subtle borders and low-elevation shadows;
- a compact translucent bottom menu;
- short opacity and transform transitions;
- semantic color only for success, warning, and error feedback.

Piko blue is reserved for the logo.

## Load Unpacked

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this repository folder.

## Structure

- `manifest.json` configures the MV3 extension.
- `src/content` contains Instagram and YouTube content entry points.
- `src/ui` contains contextual overlay controls, docks, icons, and toasts.
- `src/media` resolves Instagram media and YouTube transcripts into normalized downloadable items.
- `src/downloads` handles file saving.
- `styles` contains content and options page styling.
- `popup.html` and `src/popup` provide secondary page status and shortcuts.
- `references/extension-references` contains third-party unpacked extension references for implementation study only. Do not load, import, or mix these files into Piko.
