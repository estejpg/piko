(function () {
  function shortcodeFromAnchor(anchor) {
    return window.IgBulkMediaResolver.shortcodeFromUrl(anchor.href);
  }

  function previewFromAnchor(anchor) {
    const media = anchor && anchor.querySelector("img, video");
    if (!media) return "";
    return media.tagName === "VIDEO"
      ? media.getAttribute("poster") || ""
      : media.currentSrc || media.src || "";
  }

  function createSelectButton(anchor, selectedItems, onToggle) {
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

    syncSelectButton(anchor, button, selectedItems);
    return button;
  }

  function syncSelectButton(anchor, button, selectedItems) {
    const shortcode = shortcodeFromAnchor(anchor);
    const selected = Boolean(shortcode && selectedItems.has(shortcode));
    anchor.classList.toggle("ig-bulk-tile--selected", selected);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.innerHTML = selected ? window.IgBulkIcons.icon("check") : '<span aria-hidden="true"></span>';
  }

  function createActionBar(options, selectedItems, clearSelection) {
    const bar = document.createElement("div");
    bar.className = "ig-bulk-selection-bar ig-bulk-bottom-menu";
    bar.innerHTML = [
      '<div class="ig-bulk-selection-bar__previews" data-role="previews"></div>',
      '<div class="ig-bulk-selection-bar__meta">',
      '  <span class="ig-bulk-selection-bar__count">0 selected</span>',
      '  <span class="ig-bulk-selection-bar__progress" data-role="progress" hidden></span>',
      '</div>',
      '<button type="button" class="ig-bulk-selection-bar__download" data-action="download">',
      window.IgBulkIcons.icon("download"),
      '<span data-role="download-label">Download</span>',
      '</button>',
      '<button type="button" class="ig-bulk-selection-bar__clear" data-action="clear"><span>Clear</span></button>',
      '<button type="button" class="ig-bulk-selection-bar__done" data-action="done" aria-label="Exit Select mode" title="Exit Select mode">',
      window.IgBulkIcons.icon("clear"),
      '</button>'
    ].join("");

    const count = bar.querySelector(".ig-bulk-selection-bar__count");
    const progress = bar.querySelector('[data-role="progress"]');
    const previews = bar.querySelector('[data-role="previews"]');
    const download = bar.querySelector('[data-action="download"]');
    const downloadLabel = bar.querySelector('[data-role="download-label"]');
    const clear = bar.querySelector('[data-action="clear"]');
    const done = bar.querySelector('[data-action="done"]');
    let busy = false;

    download.addEventListener("click", () => {
      const shortcodes = Array.from(selectedItems.keys());
      if (!shortcodes.length || busy) return;
      options.onDownloadSelected(shortcodes, {
        clearSelection,
        setBusy,
        setProgress
      });
    });

    clear.addEventListener("click", () => clearSelection());
    done.addEventListener("click", () => {
      if (busy) return;
      if (options.onExitSelectionMode) options.onExitSelectionMode();
    });

    function renderPreviews() {
      previews.textContent = "";
      Array.from(selectedItems.values()).slice(0, 5).forEach((item) => {
        if (!item.previewUrl) return;
        const image = document.createElement("img");
        image.src = item.previewUrl;
        image.alt = "";
        previews.appendChild(image);
      });
      if (selectedItems.size > 5) {
        const more = document.createElement("span");
        more.className = "ig-bulk-selection-bar__more";
        more.textContent = `+${selectedItems.size - 5}`;
        previews.appendChild(more);
      }
    }

    function update(active) {
      const selectedCount = selectedItems.size;
      count.textContent = `${selectedCount} selected`;
      downloadLabel.textContent = options.isThumbnailMode && options.isThumbnailMode() ? "Download thumbs" : "Download";
      bar.classList.toggle("is-visible", Boolean(active));
      download.disabled = busy || selectedCount === 0;
      clear.disabled = busy || selectedCount === 0;
      done.disabled = busy;
      renderPreviews();
    }

    function setBusy(nextBusy) {
      busy = Boolean(nextBusy);
      bar.classList.toggle("is-busy", busy);
      download.disabled = busy || selectedItems.size === 0;
      clear.disabled = busy || selectedItems.size === 0;
      done.disabled = busy;
      download.classList.toggle("is-loading", busy);
    }

    function setProgress(message) {
      progress.textContent = message || "";
      progress.hidden = !message;
      count.hidden = Boolean(message);
    }

    return { element: bar, setBusy, setProgress, update };
  }

  function createProfileMultiSelect(options) {
    const anchors = new Set();
    const selectedItems = new Map();
    let actionBar = null;
    let active = false;

    function updateAllButtons() {
      anchors.forEach((anchor) => {
        if (!anchor.isConnected) {
          anchors.delete(anchor);
          return;
        }
        const button = anchor.querySelector(".ig-bulk-tile-select");
        if (button) syncSelectButton(anchor, button, selectedItems);
      });
      if (actionBar) actionBar.update(active);
    }

    function clearSelection() {
      selectedItems.clear();
      if (actionBar) {
        actionBar.setBusy(false);
        actionBar.setProgress("");
      }
      updateAllButtons();
    }

    function toggleAnchor(anchor) {
      const shortcode = shortcodeFromAnchor(anchor);
      if (!shortcode || !active) return;
      if (selectedItems.has(shortcode)) selectedItems.delete(shortcode);
      else selectedItems.set(shortcode, { shortcode, previewUrl: previewFromAnchor(anchor) });
      updateAllButtons();
    }

    function shouldDecorate(anchor) {
      if (!active || !anchor || anchor.querySelector(".ig-bulk-tile-select")) return false;
      if (anchor.closest('[role="dialog"], [aria-modal="true"]')) return false;
      if (!shortcodeFromAnchor(anchor)) return false;
      return Boolean(anchor.querySelector("img, video"));
    }

    function ensureActionBar() {
      if (actionBar) return;
      actionBar = createActionBar(options, selectedItems, clearSelection);
      document.body.appendChild(actionBar.element);
      actionBar.update(active);
    }

    function injectAnchor(anchor) {
      if (!shouldDecorate(anchor)) return;
      anchor.classList.add("ig-bulk-tile", "ig-bulk-selectable-tile");
      anchor.appendChild(createSelectButton(anchor, selectedItems, toggleAnchor));
      anchors.add(anchor);
    }

    function removeSelectionControls() {
      anchors.forEach((anchor) => {
        anchor.querySelectorAll(".ig-bulk-tile-select").forEach((button) => button.remove());
        anchor.classList.remove("ig-bulk-selectable-tile", "ig-bulk-tile--selected");
      });
      anchors.clear();
    }

    function setActive(nextActive) {
      active = Boolean(nextActive);
      ensureActionBar();
      if (!active) {
        clearSelection();
        removeSelectionControls();
      }
      refresh();
      if (options.onSelectionModeChanged) options.onSelectionModeChanged(active);
    }

    function refresh() {
      ensureActionBar();
      anchors.forEach((anchor) => {
        if (!anchor.isConnected) anchors.delete(anchor);
      });
      if (active) {
        document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"], main a[href*="/tv/"]').forEach(injectAnchor);
      }
      updateAllButtons();
    }

    function destroy() {
      active = false;
      removeSelectionControls();
      selectedItems.clear();
      if (actionBar) {
        actionBar.element.remove();
        actionBar = null;
      }
    }

    return {
      clearSelection,
      destroy,
      isActive() {
        return active;
      },
      refresh,
      setActive
    };
  }

  window.IgBulkProfileMultiSelect = { createProfileMultiSelect };
})();
