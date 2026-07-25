# AGENTS.md

## Cursor Cloud specific instructions

Piko is a no-build Chrome Manifest V3 extension (see `README.md` and `HANDOFF.md`). There is
**no package manager, lockfile, bundler, or backend** — the extension is plain JS/CSS/HTML loaded
directly by `manifest.json` from the repo root. Node.js is available in the environment and is used
only for the validation scripts below (no runtime dependency).

### Lint / test / build
- There is no lint, unit-test, or build tooling. The "tests" are the two validation scripts in
  `HANDOFF.md` (JS `node --check` over all `.js` files, and a manifest asset-existence check). Run
  those before handing off changes.
- No `dist/` / build step exists and none should be added unless a task explicitly asks for it.

### Running / manually testing the extension
- Load the extension by launching Chrome with the repo root as an unpacked extension:
  `google-chrome-stable --no-first-run --no-default-browser-check --load-extension=/workspace --disable-extensions-except=/workspace --user-data-dir=/tmp/chrome-piko-profile &`
- Gotcha: the `--load-extension` flag alone did not reliably register the extension in this
  environment. If Piko does not appear, open `chrome://extensions`, enable **Developer mode**
  (top-right), and use **Load unpacked** → select the repo root (`/workspace`). Reload the
  extension card after any code change (SPA content scripts do not hot-reload).
- Best no-login smoke test (good "hello world"): open a YouTube watch page (e.g.
  `https://www.youtube.com/watch?v=dQw4w9WgXcQ`) and click Piko's injected **Thumbnail** button in
  YouTube's native action row — it downloads the thumbnail and shows a "Thumbnail saved" toast. The
  **Transcript** button works the same way. Instagram flows and bulk/folder downloads require being
  logged in to the host site in the same Chrome profile.
- `references/extension-references/` is read-only third-party study material. Do not load it as Piko
  or import from it.
