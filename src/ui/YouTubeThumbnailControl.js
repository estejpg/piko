(function () {
  function createYouTubeThumbnailControl(actions) {
    const root = document.createElement("div");
    root.id = "ig-bulk-youtube-control";
    root.className = "ig-bulk-youtube-control";
    root.innerHTML = [
      '<button type="button" class="ig-bulk-youtube-thumbnail-button" data-action="thumbnail" aria-label="Download YouTube thumbnail" title="Download YouTube thumbnail">',
      window.IgBulkIcons.icon("thumbnail"),
      '<span>Thumbnail</span>',
      '</button>',
      '<button type="button" class="ig-bulk-youtube-transcript-button" data-action="transcript" aria-label="Download transcript" title="Download transcript">',
      window.IgBulkIcons.icon("download"),
      '<span>Transcript</span>',
      '</button>'
    ].join("");

    const thumbnailButton = root.querySelector('[data-action="thumbnail"]');
    const transcriptButton = root.querySelector('[data-action="transcript"]');

    thumbnailButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (thumbnailButton.disabled) return;
      actions.download(thumbnailButton);
    });

    transcriptButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (transcriptButton.disabled) return;
      if (actions.downloadTranscript) actions.downloadTranscript(transcriptButton);
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
        transcriptButton.title = available ? "Download transcript" : "Download transcript if available";
      }
    };
  }

  function createCardControls(cardData, actions) {
    let currentCardData = cardData;
    const root = document.createElement("div");
    root.className = "ig-bulk-youtube-card-controls";
    root.innerHTML = [
      '<button type="button" class="ig-bulk-youtube-card-button" data-action="download" aria-label="Download thumbnail" title="Download thumbnail">',
      window.IgBulkIcons.icon("download"),
      '<span>Thumbnail</span>',
      '</button>',
      '<button type="button" class="ig-bulk-youtube-card-button" data-action="select" aria-label="Select thumbnail" title="Select thumbnail" aria-pressed="false">',
      window.IgBulkIcons.icon("check"),
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
      if (action === "select") actions.toggleSelect(nextCardData, button);
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
      setSelected(selected) {
        const button = root.querySelector('[data-action="select"]');
        if (!button) return;
        button.classList.toggle("is-selected", Boolean(selected));
        button.setAttribute("aria-pressed", selected ? "true" : "false");
        button.title = selected ? "Remove thumbnail from selection" : "Select thumbnail";
        button.setAttribute("aria-label", selected ? "Remove thumbnail from selection" : "Select thumbnail");
      }
    };
  }

  function createSelectionDock(actions) {
    const root = document.createElement("div");
    root.className = "ig-bulk-youtube-selection-dock";
    root.innerHTML = [
      '<div class="ig-bulk-youtube-selection-dock__meta">',
      '  <span class="ig-bulk-youtube-selection-dock__count">0 selected</span>',
      '  <span class="ig-bulk-youtube-selection-dock__progress" data-role="progress" hidden></span>',
      '</div>',
      '<div class="ig-bulk-youtube-selection-dock__previews" data-role="previews"></div>',
      '<button type="button" data-action="download">',
      window.IgBulkIcons.icon("download"),
      '<span>Download selected</span>',
      '</button>',
      '<button type="button" class="ig-bulk-youtube-selection-dock__clear" data-action="clear" aria-label="Clear selection" title="Clear selection">',
      window.IgBulkIcons.icon("clear"),
      '</button>'
    ].join("");

    const count = root.querySelector(".ig-bulk-youtube-selection-dock__count");
    const progress = root.querySelector('[data-role="progress"]');
    const previews = root.querySelector('[data-role="previews"]');
    const download = root.querySelector('[data-action="download"]');
    const clear = root.querySelector('[data-action="clear"]');
    let busy = false;
    let previewKey = "";

    download.addEventListener("click", () => actions.downloadSelected());
    clear.addEventListener("click", () => actions.clearSelection());

    function renderPreviews(items) {
      const nextPreviewKey = items.map((item) => item.videoId || item.id || item.previewUrl || "").join("|");
      if (nextPreviewKey === previewKey) return;
      previewKey = nextPreviewKey;
      previews.textContent = "";
      items.slice(0, 7).forEach((item) => {
        const img = document.createElement("img");
        img.alt = "";
        img.src = item.previewUrl || "";
        previews.appendChild(img);
      });
      if (items.length > 7) {
        const more = document.createElement("span");
        more.className = "ig-bulk-youtube-selection-dock__more";
        more.textContent = `+${items.length - 7}`;
        previews.appendChild(more);
      }
    }

    return {
      element: root,
      setBusy(nextBusy) {
        busy = Boolean(nextBusy);
        root.classList.toggle("is-busy", busy);
        download.disabled = busy;
        clear.disabled = busy;
        download.classList.toggle("is-loading", busy);
      },
      setProgress(message) {
        progress.textContent = message || "";
        progress.hidden = !message;
      },
      update(items) {
        const selectedCount = items.length;
        count.textContent = `${selectedCount} selected`;
        root.classList.toggle("is-visible", selectedCount > 0);
        download.disabled = busy || selectedCount === 0;
        clear.disabled = busy;
        renderPreviews(items);
      }
    };
  }

  window.IgBulkYouTubeThumbnailControl = {
    createCardControls,
    createSelectionDock,
    createYouTubeThumbnailControl
  };
})();
