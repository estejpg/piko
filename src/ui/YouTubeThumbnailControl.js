(function () {
  function createYouTubeThumbnailControl(actions) {
    const root = document.createElement("div");
    root.id = "ig-bulk-youtube-control";
    root.className = "ig-bulk-youtube-control";
    root.innerHTML = [
      '<button type="button" class="ig-bulk-youtube-thumbnail-button" data-action="thumbnail" aria-label="Download thumbnail" title="Download thumbnail">',
      window.IgBulkIcons.icon("thumbnail"),
      '<span>Thumbnail</span>',
      '</button>',
      '<button type="button" class="ig-bulk-youtube-transcript-button" data-action="transcript" aria-label="Download transcript" title="Download transcript">',
      window.IgBulkIcons.icon("transcript"),
      '<span>Transcript</span>',
      '</button>'
    ].join("");

    const thumbnailButton = root.querySelector('[data-action="thumbnail"]');
    const transcriptButton = root.querySelector('[data-action="transcript"]');

    thumbnailButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!thumbnailButton.disabled) actions.download(thumbnailButton);
    });

    transcriptButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!transcriptButton.disabled && actions.downloadTranscript) actions.downloadTranscript(transcriptButton);
    });

    return {
      element: root,
      setBusy(busy) {
        thumbnailButton.disabled = Boolean(busy);
        thumbnailButton.classList.toggle("is-loading", Boolean(busy));
        thumbnailButton.setAttribute("aria-disabled", busy ? "true" : "false");
      },
      setTranscriptBusy(busy) {
        transcriptButton.disabled = Boolean(busy);
        transcriptButton.classList.toggle("is-loading", Boolean(busy));
        transcriptButton.setAttribute("aria-disabled", busy ? "true" : "false");
      },
      setTranscriptAvailable(available) {
        transcriptButton.title = available ? "Download transcript" : "Try to download transcript";
      }
    };
  }

  function createCardControls(cardData, actions) {
    let currentCardData = cardData;
    let selectionMode = false;
    const root = document.createElement("div");
    root.className = "ig-bulk-youtube-card-controls";
    root.innerHTML = [
      '<button type="button" class="ig-bulk-youtube-card-button" data-action="download" aria-label="Download thumbnail" title="Download thumbnail">',
      window.IgBulkIcons.icon("download"),
      '<span>Thumbnail</span>',
      '</button>',
      '<button type="button" class="ig-bulk-youtube-card-button ig-bulk-youtube-card-select" data-action="select" aria-label="Select thumbnail" title="Select thumbnail" aria-pressed="false">',
      '<span aria-hidden="true"></span>',
      '</button>'
    ].join("");

    function resolvedCardData() {
      if (actions.resolveCardData) {
        const nextCardData = actions.resolveCardData(currentCardData);
        if (nextCardData && nextCardData.videoId) currentCardData = nextCardData;
      }
      return currentCardData;
    }

    root.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.getAttribute("data-action");
      const nextCardData = resolvedCardData();
      if (action === "download") actions.download(nextCardData, button);
      if (action === "select" && selectionMode) actions.toggleSelect(nextCardData, button);
    });

    return {
      element: root,
      get cardData() {
        return resolvedCardData();
      },
      setCardData(nextCardData) {
        if (nextCardData && nextCardData.videoId) currentCardData = nextCardData;
      },
      setBusy(busy) {
        const button = root.querySelector('[data-action="download"]');
        if (!button) return;
        button.disabled = Boolean(busy);
        button.classList.toggle("is-loading", Boolean(busy));
        button.setAttribute("aria-disabled", busy ? "true" : "false");
      },
      setSelectionMode(enabled) {
        selectionMode = Boolean(enabled);
        root.classList.toggle("is-selection-mode", selectionMode);
      },
      setSelected(selected) {
        const button = root.querySelector('[data-action="select"]');
        if (!button) return;
        button.classList.toggle("is-selected", Boolean(selected));
        button.setAttribute("aria-pressed", selected ? "true" : "false");
        button.title = selected ? "Remove thumbnail from selection" : "Select thumbnail";
        button.setAttribute("aria-label", selected ? "Remove thumbnail from selection" : "Select thumbnail");
        button.innerHTML = selected ? window.IgBulkIcons.icon("check") : '<span aria-hidden="true"></span>';
      }
    };
  }

  function createPageMenu(actions) {
    const root = document.createElement("nav");
    root.className = "ig-bulk-youtube-page-menu ig-bulk-bottom-menu ig-bulk-page-menu";
    root.setAttribute("aria-label", "Piko YouTube actions");
    root.innerHTML = [
      '<div class="ig-bulk-bottom-menu__rail" role="toolbar">',
      '  <button type="button" class="ig-bulk-icon-button" data-action="select" aria-label="Select thumbnails" title="Select thumbnails">',
      window.IgBulkIcons.icon("select"),
      '    <span>Select</span>',
      '  </button>',
      '  <button type="button" class="ig-bulk-icon-button" data-action="settings" aria-label="Open Piko settings" title="Open Piko settings">',
      window.IgBulkIcons.icon("settings"),
      '    <span>Settings</span>',
      '  </button>',
      '</div>'
    ].join("");

    root.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.dataset.action;
      if (action === "select") actions.toggleSelectionMode();
      if (action === "settings") actions.openSettings();
    });

    return {
      element: root,
      setSelectionMode(enabled) {
        const button = root.querySelector('[data-action="select"]');
        button.classList.toggle("is-active", Boolean(enabled));
        button.setAttribute("aria-pressed", enabled ? "true" : "false");
        root.classList.toggle("is-suppressed", Boolean(enabled));
      },
      setVisible(visible) {
        root.classList.toggle("is-route-visible", Boolean(visible));
      },
      setWatchDeferred(deferred) {
        const nextDeferred = Boolean(deferred);
        const wasDeferred = root.classList.contains("is-watch-deferred");
        root.classList.toggle("is-watch-deferred", nextDeferred);

        // Animate the rail when it first becomes available after scrolling past the description.
        if (wasDeferred && !nextDeferred && root.classList.contains("is-route-visible")) {
          root.classList.remove("is-watch-revealing");
          // Force restart so repeated scroll-up/down still plays the enter motion.
          void root.offsetWidth;
          root.classList.add("is-watch-revealing");
          clearTimeout(root.__igBulkRevealTimer);
          root.__igBulkRevealTimer = setTimeout(() => {
            root.classList.remove("is-watch-revealing");
          }, 450);
        } else if (nextDeferred) {
          root.classList.remove("is-watch-revealing");
          clearTimeout(root.__igBulkRevealTimer);
        }
      }
    };
  }

  function createSelectionDock(actions) {
    const root = document.createElement("div");
    root.className = "ig-bulk-youtube-selection-dock ig-bulk-bottom-menu";
    root.innerHTML = [
      '<div class="ig-bulk-youtube-selection-dock__previews" data-role="previews"></div>',
      '<div class="ig-bulk-youtube-selection-dock__meta">',
      '  <span class="ig-bulk-youtube-selection-dock__count">0 selected</span>',
      '  <span class="ig-bulk-youtube-selection-dock__progress" data-role="progress" hidden></span>',
      '</div>',
      '<button type="button" class="ig-bulk-youtube-selection-dock__download" data-action="download">',
      window.IgBulkIcons.icon("download"),
      '<span>Download</span>',
      '</button>',
      '<button type="button" class="ig-bulk-youtube-selection-dock__clear" data-action="clear"><span>Clear</span></button>',
      '<button type="button" class="ig-bulk-youtube-selection-dock__done" data-action="done" aria-label="Exit Select mode" title="Exit Select mode">',
      window.IgBulkIcons.icon("clear"),
      '</button>'
    ].join("");

    const count = root.querySelector(".ig-bulk-youtube-selection-dock__count");
    const progress = root.querySelector('[data-role="progress"]');
    const previews = root.querySelector('[data-role="previews"]');
    const download = root.querySelector('[data-action="download"]');
    const clear = root.querySelector('[data-action="clear"]');
    const done = root.querySelector('[data-action="done"]');
    let busy = false;
    let previewKey = "";
    let active = false;

    download.addEventListener("click", () => actions.downloadSelected());
    clear.addEventListener("click", () => actions.clearSelection());
    done.addEventListener("click", () => actions.exitSelectionMode());

    function renderPreviews(items) {
      const nextPreviewKey = items.map((item) => item.videoId || item.id || item.previewUrl || "").join("|");
      if (nextPreviewKey === previewKey) return;
      previewKey = nextPreviewKey;
      previews.textContent = "";
      items.slice(0, 5).forEach((item) => {
        const img = document.createElement("img");
        img.alt = "";
        img.src = item.previewUrl || "";
        previews.appendChild(img);
      });
      if (items.length > 5) {
        const more = document.createElement("span");
        more.className = "ig-bulk-youtube-selection-dock__more";
        more.textContent = `+${items.length - 5}`;
        previews.appendChild(more);
      }
    }

    return {
      element: root,
      setActive(nextActive) {
        active = Boolean(nextActive);
        root.classList.toggle("is-visible", active);
      },
      setBusy(nextBusy) {
        busy = Boolean(nextBusy);
        root.classList.toggle("is-busy", busy);
        download.disabled = busy;
        clear.disabled = busy;
        done.disabled = busy;
        download.classList.toggle("is-loading", busy);
      },
      setProgress(message) {
        progress.textContent = message || "";
        progress.hidden = !message;
        count.hidden = Boolean(message);
      },
      update(items) {
        const selectedCount = items.length;
        count.textContent = `${selectedCount} selected`;
        root.classList.toggle("is-visible", active);
        download.disabled = busy || selectedCount === 0;
        clear.disabled = busy || selectedCount === 0;
        done.disabled = busy;
        renderPreviews(items);
      }
    };
  }

  window.IgBulkYouTubeThumbnailControl = {
    createCardControls,
    createPageMenu,
    createSelectionDock,
    createYouTubeThumbnailControl
  };
})();
