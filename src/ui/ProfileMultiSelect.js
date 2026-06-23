(function () {
  function shortcodeFromAnchor(anchor) {
    return window.IgBulkMediaResolver.shortcodeFromUrl(anchor.href);
  }

  function createSelectButton(anchor, selectedShortcodes, onToggle) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ig-bulk-tile-select";
    button.title = "Select this media";
    button.setAttribute("aria-label", "Select this Instagram media");

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onToggle(anchor);
    });

    syncSelectButton(anchor, button, selectedShortcodes);
    return button;
  }

  function syncSelectButton(anchor, button, selectedShortcodes) {
    const shortcode = shortcodeFromAnchor(anchor);
    const selected = Boolean(shortcode && selectedShortcodes.has(shortcode));
    anchor.classList.toggle("ig-bulk-tile--selected", selected);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.innerHTML = selected ? window.IgBulkIcons.icon("check") : '<span aria-hidden="true"></span>';
  }

  function createActionBar(options, selectedShortcodes, clearSelection) {
    const bar = document.createElement("div");
    bar.className = "ig-bulk-selection-bar";
    bar.innerHTML = [
      '<div class="ig-bulk-selection-bar__meta">',
      '  <span class="ig-bulk-selection-bar__count">0 selected</span>',
      '  <span class="ig-bulk-selection-bar__progress" data-role="progress" hidden></span>',
      '</div>',
      '<button type="button" data-action="download">',
      window.IgBulkIcons.icon("download"),
      '<span data-role="download-label">Download selected</span>',
      '</button>',
      '<button type="button" class="ig-bulk-selection-bar__clear" data-action="clear" aria-label="Clear selection" title="Clear selection">',
      window.IgBulkIcons.icon("clear"),
      '</button>'
    ].join("");

    const count = bar.querySelector(".ig-bulk-selection-bar__count");
    const progress = bar.querySelector('[data-role="progress"]');
    const download = bar.querySelector('[data-action="download"]');
    const downloadLabel = bar.querySelector('[data-role="download-label"]');
    const clear = bar.querySelector('[data-action="clear"]');

    download.addEventListener("click", () => {
      const shortcodes = Array.from(selectedShortcodes);
      if (!shortcodes.length) return;
      options.onDownloadSelected(shortcodes, {
        clearSelection,
        setBusy,
        setProgress
      });
    });

    clear.addEventListener("click", () => clearSelection());

    function update() {
      const selectedCount = selectedShortcodes.size;
      count.textContent = `${selectedCount} selected`;
      if (downloadLabel) downloadLabel.textContent = options.isThumbnailMode && options.isThumbnailMode() ? "Download thumbnails" : "Download selected";
      bar.classList.toggle("is-visible", selectedCount > 0);
      download.disabled = selectedCount === 0;
    }

    function setBusy(busy) {
      bar.classList.toggle("is-busy", Boolean(busy));
      download.disabled = Boolean(busy) || selectedShortcodes.size === 0;
      download.classList.toggle("is-loading", Boolean(busy));
    }

    function setProgress(message) {
      progress.textContent = message || "";
      progress.hidden = !message;
    }

    return { element: bar, setBusy, setProgress, update };
  }

  function createProfileMultiSelect(options) {
    const anchors = new Set();
    const selectedShortcodes = new Set();
    let actionBar = null;

    function updateAllButtons() {
      anchors.forEach((anchor) => {
        if (!anchor.isConnected) {
          anchors.delete(anchor);
          return;
        }
        const button = anchor.querySelector(".ig-bulk-tile-select");
        if (button) syncSelectButton(anchor, button, selectedShortcodes);
      });
      if (actionBar) actionBar.update();
    }

    function clearSelection() {
      selectedShortcodes.clear();
      if (actionBar) {
        actionBar.setBusy(false);
        actionBar.setProgress("");
      }
      updateAllButtons();
    }

    function toggleAnchor(anchor) {
      const shortcode = shortcodeFromAnchor(anchor);
      if (!shortcode) return;
      if (selectedShortcodes.has(shortcode)) selectedShortcodes.delete(shortcode);
      else selectedShortcodes.add(shortcode);
      updateAllButtons();
    }

    function shouldDecorate(anchor) {
      if (!anchor || anchor.querySelector(".ig-bulk-tile-select")) return false;
      if (anchor.closest('[role="dialog"], [aria-modal="true"]')) return false;
      if (!shortcodeFromAnchor(anchor)) return false;
      return Boolean(anchor.querySelector("img, video"));
    }

    function ensureActionBar() {
      if (actionBar) return;
      actionBar = createActionBar(options, selectedShortcodes, clearSelection);
      document.body.appendChild(actionBar.element);
      actionBar.update();
    }

    function injectAnchor(anchor) {
      if (!shouldDecorate(anchor)) return;
      anchor.classList.add("ig-bulk-tile", "ig-bulk-selectable-tile");
      anchor.appendChild(createSelectButton(anchor, selectedShortcodes, toggleAnchor));
      anchors.add(anchor);
    }

    function refresh() {
      ensureActionBar();
      anchors.forEach((anchor) => {
        if (!anchor.isConnected) anchors.delete(anchor);
      });
      document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"], main a[href*="/tv/"]').forEach(injectAnchor);
      updateAllButtons();
    }

    function destroy() {
      anchors.forEach((anchor) => {
        anchor.querySelectorAll(".ig-bulk-tile-select").forEach((button) => button.remove());
        anchor.classList.remove("ig-bulk-selectable-tile", "ig-bulk-tile--selected");
      });
      anchors.clear();
      selectedShortcodes.clear();
      if (actionBar) {
        actionBar.element.remove();
        actionBar = null;
      }
    }

    return { clearSelection, destroy, refresh };
  }

  window.IgBulkProfileMultiSelect = { createProfileMultiSelect };
})();
