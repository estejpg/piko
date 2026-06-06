# Piko

Piko is a lightweight Chrome extension for saving Instagram media and YouTube thumbnails from contextual, native-feeling controls.

## Features

- Download Instagram feed posts, reels, single images, and carousels.
- Use profile-grid hover controls, multi-select, and thumbnail mode.
- Save YouTube thumbnails from watch pages, home cards, and recommended videos.
- Reuse shared download settings and folder preferences across supported surfaces.

## Load Unpacked

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this repository folder.

## Structure

- `manifest.json` configures the MV3 extension.
- `src/content` contains Instagram and YouTube content entry points.
- `src/ui` contains contextual overlay controls, docks, icons, and toasts.
- `src/media` resolves Instagram media into normalized downloadable items.
- `src/downloads` handles file saving.
- `styles` contains content and options page styling.
- `references/extension-references` contains third-party unpacked extension references for implementation study only. Do not load, import, or mix these files into Piko.
