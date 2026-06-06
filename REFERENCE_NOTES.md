# Reference Notes For Cursor

This file captures repo-safe lessons from the Chrome extensions that were studied while developing Piko. Cursor cloud agents can access this repository, but they cannot access local folders on the developer's Mac. Do not copy third-party extension code into Piko. Use these notes only as design and architecture context.

## Why This Exists

Piko was originally informed by several unpacked Chrome Web Store extensions. Those local folders were useful for learning how mature extensions structure content scripts, page overlays, SPA navigation handling, and download flows, but they should not become source dependencies.

Cursor should receive:

- Behavioral summaries.
- Architectural patterns.
- Risk notes and constraints.
- UI/interaction principles.
- Validation ideas.

Cursor should not receive:

- Raw third-party source files.
- Decompiled/minified bundles copied into this repo.
- Assets, icons, or branding from other extensions.
- Private implementation details used verbatim.

## Reference Extensions Studied

### Turbo Downloader For Instagram

Used as the main reference for Instagram survivability and media resolution strategy.

Useful lessons:

- Split page-context access from isolated content scripts.
- Use a `MAIN` world bridge for data that only exists in the page runtime.
- Keep Instagram-private internals behind one narrow boundary.
- Combine route detection, mutation observation, and download orchestration in a controller layer.
- Normalize media into a common item shape before downloading.
- Handle single media, videos/reels, and carousel media through the same pipeline.
- Add fallbacks because Instagram DOM and runtime internals change frequently.

Piko implementation touchpoints:

- `src/content/mainWorldBridge.js`
- `src/content/instagramContent.js`
- `src/media/mediaResolver.js`
- `src/downloads/downloader.js`

Constraints:

- Do not copy Turbo code.
- Do not spread Instagram private runtime probing across the app.
- Keep bridge calls narrow and resilient.

### Viewstats

Used as a reference for contextual overlays, route-aware UI, SPA navigation awareness, and lightweight inline/floating surfaces.

Useful lessons:

- Classify host-site routes before mounting UI.
- Watch SPA navigation events and DOM changes without duplicating controls.
- Mount UI near stable host-page anchors.
- Keep overlays contextual and scoped to the current route.
- Close floating surfaces on outside click or route changes.

Piko implementation touchpoints:

- `src/content/instagramContent.js`
- `src/ui/ProfileSideMenu.js`
- `src/ui/FeedTopButton.js`
- `src/ui/TimelinePostActions.js`
- `src/ui/ProfileHoverButtons.js`

Constraints:

- Do not clone Viewstats layouts or visual branding.
- Preserve Piko's compact, native-feeling design language.

### Ostendo

Used as a reference for polished lightweight controls, consistent motion, header/action injection discipline, and perceived responsiveness.

Useful lessons:

- Prefer one stable injected control over repeated DOM churn.
- Use compact buttons with clear states.
- Keep motion based on opacity/transform.
- Make loading and busy states feel intentional.
- Avoid disrupting the host site's layout.

Piko implementation touchpoints:

- `src/ui/ToastHost.js`
- `src/ui/icons.js`
- `styles/content.css`
- `styles/options.css`
- YouTube thumbnail controls in `src/ui/YouTubeThumbnailControl.js`

Constraints:

- Do not copy Ostendo UI, assets, animations, or code.
- Use Piko's own icons and design tokens.

### ClickPilot

Used as inspiration for restrained contextual hover overlays and compact action surfaces.

Useful lessons:

- Show controls only when contextually useful.
- Let hover controls feel like part of the host media surface.
- Avoid large utility panels.
- Keep selection and action docks compact.
- Preserve scroll performance by minimizing injected DOM.

Piko implementation touchpoints:

- Profile hover controls.
- Timeline media hover downloads.
- YouTube card thumbnail controls.
- Selected thumbnail/profile action docks.

Constraints:

- Do not copy ClickPilot code or layouts.
- Reuse only the interaction principle: compact, contextual, low-clutter UI.

### Screenshot YouTube / Similar YouTube Thumbnail Tools

Used as broad context for YouTube surface detection and thumbnail URL behavior.

Useful lessons:

- YouTube video IDs can be resolved from `/watch?v=...` links.
- Thumbnail candidates usually follow `https://i.ytimg.com/vi/{VIDEO_ID}/{QUALITY}.jpg`.
- Try higher-quality candidates first and gracefully fall back.
- YouTube is an SPA, so watch navigation events and run idempotent card scans.

Piko implementation touchpoints:

- `src/content/youtubeContent.js`
- `src/ui/YouTubeThumbnailControl.js`
- `src/shared/filename.js`
- `src/downloads/downloader.js`

Constraints:

- Shorts support is not currently the primary target.
- Avoid heavy scans on infinite-scroll pages.

## Current Piko Reference-Inspired Patterns

### Main-World Bridge

Instagram content uses a split:

- `src/content/mainWorldBridge.js` runs in the page context.
- `src/content/instagramContent.js` runs in the isolated extension context.
- Messages pass through the shared vocabulary in `src/shared/messages.js`.

Keep this split. It is the safest place to contain brittle Instagram internals.

### Route-Aware Mounting

Piko should mount only the controls relevant to the current route:

- Instagram profile route: profile dock, hover controls, multi-select.
- Instagram feed route: feed dock and timeline media hover controls.
- Instagram post/modal route: media hover download control.
- YouTube watch route: watch-page thumbnail control plus recommended card controls.
- YouTube home route: card thumbnail controls.

Avoid global UI that appears everywhere.

### Idempotent DOM Injection

All host-page UI injection must be repeat-safe:

- Do not duplicate buttons during scroll.
- Do not duplicate buttons after SPA navigation.
- Clean up when routes change.
- Prefer stable media containers or action anchors.
- Throttle DOM scans.

This is especially important for Instagram profile grids and YouTube infinite scroll.

### Shared Settings And Downloads

Keep all surfaces using the same shared modules:

- Settings: `src/shared/settingsStore.js`
- Filenames: `src/shared/filename.js`
- Downloads: `src/downloads/downloader.js`
- Toasts: `src/ui/ToastHost.js`

Do not add separate settings state for Instagram, YouTube, profile, feed, or modal flows.

### Unified Media Item Shape

Piko should resolve every downloadable asset into a normalized item before saving.

Expected fields commonly include:

- `id`
- `ownerUsername`
- `takenAt`
- `mediaType`
- `url`
- `filename`
- `order`

Carousels should preserve order and produce unique filenames.

### UI Product Principles

Piko should feel like lightweight media workflow tooling:

- Minimal.
- Premium.
- Calm.
- Native to the host page.
- Contextual rather than dashboard-like.
- Compact floating surfaces.
- Smooth opacity/transform transitions.
- Clear loading, selected, active, and error states.

Avoid:

- Large sidebars.
- Persistent clutter.
- Layout-shifting wrappers.
- Heavy shadows or loud effects.
- Host action-row disruption.

## Recommended Cursor Context Package

If Cursor needs more reference context later, provide notes in this shape rather than raw third-party folders:

```md
## Reference: Extension Name

Purpose studied:
- ...

Relevant behavior:
- ...

Architecture lesson:
- ...

Piko files affected:
- ...

Do not copy:
- ...

Risks:
- ...
```

Screenshots or short human-written summaries are safer than copied source. If a specific snippet from a third-party extension seems important, rewrite the idea in original words and implement it using Piko's existing modules.

## Known Local Reference Folder Status

The reference extension folders are not part of this repo and should stay out of GitHub. As of this handoff, Piko's repo root is clean and contains only the extension source and documentation.

Suggested local-only organization, if the reference folders still exist elsewhere on the developer's Mac:

```text
Extension References/
  instagram/
    turbo-downloader-for-instagram/
  youtube/
    viewstats/
    ostendo-youtube-screenshots/
    screenshot-youtube/
  workflow-ui/
    clickpilot-clipper/
    klemmbrett/
  notes/
    README.md
```

Keep that folder outside the Piko repo. Do not commit it.

## Safe Next Steps For Cursor

1. Read `HANDOFF.md`.
2. Read this file.
3. Inspect `manifest.json` for load order before editing content scripts.
4. Run the validation commands from `HANDOFF.md`.
5. Make small, focused changes that preserve the existing architecture.
6. Manually QA in Chrome with the unpacked extension when working on host-page UI.

