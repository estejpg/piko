(function () {
  const settingsStore = window.IgBulkSettingsStore;
  const filenameTools = window.IgBulkFilename;
  const downloader = window.IgBulkDownloader;
  const ui = window.IgBulkYouTubeThumbnailControl;
  const transcript = window.IgBulkYouTubeTranscript;

  let settings = settingsStore.defaults();
  let control = null;
  let selectionDock = null;
  let toastHost = null;
  let lastVideoId = "";
  let refreshTimer = null;
  let selectionBusy = false;

  const selected = new Map();
  const cardControls = new Map();

  function getToastHost() {
    if (!toastHost) toastHost = window.IgBulkToastHost.createToastHost();
    return toastHost;
  }

  function showToast(toast, timeoutMs) {
    return getToastHost().show({ timeoutMs, ...(toast || {}) });
  }

  function updateToast(id, toast) {
    return getToastHost().update(id, toast);
  }

  function currentVideoId() {
    try {
      const url = new URL(location.href);
      if (url.pathname !== "/watch") return "";
      return url.searchParams.get("v") || "";
    } catch (error) {
      return "";
    }
  }

  function isHomeRoute() {
    try {
      const url = new URL(location.href);
      return url.pathname === "/";
    } catch (error) {
      return false;
    }
  }

  function isChannelRoute() {
    try {
      const url = new URL(location.href);
      return url.pathname.startsWith("/@") || url.pathname.startsWith("/c/") || url.pathname.startsWith("/channel/") || url.pathname.startsWith("/user/");
    } catch (error) {
      return false;
    }
  }

  function videoIdFromHref(href) {
    try {
      const url = new URL(href, location.origin);
      if (url.pathname !== "/watch") return "";
      return url.searchParams.get("v") || "";
    } catch (error) {
      return "";
    }
  }

  function textFrom(node) {
    return node ? String(node.textContent || node.title || node.getAttribute("aria-label") || "").trim() : "";
  }

  function channelName(root) {
    const scopedCandidates = [
      "#channel-name a",
      "ytd-channel-name a",
      ".ytd-channel-name a",
      "#metadata #byline-container a",
      "#text-container a"
    ];
    for (const selector of scopedCandidates) {
      const node = root && root.querySelector && root.querySelector(selector);
      const value = textFrom(node);
      if (value) return value;
    }

    const pageCandidates = [
      "#owner #channel-name a",
      "ytd-watch-metadata ytd-channel-name a",
      "meta[itemprop='author']"
    ];
    for (const selector of pageCandidates) {
      const node = document.querySelector(selector);
      const value = node && (node.content || node.textContent || "").trim();
      if (value) return value;
    }
    return "youtube";
  }

  function thumbnailCandidates(videoId) {
    return ["maxresdefault.jpg", "sddefault.jpg", "hqdefault.jpg", "mqdefault.jpg"].map((name) => ({
      name,
      url: `https://i.ytimg.com/vi/${videoId}/${name}`
    }));
  }

  function previewUrl(videoId) {
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }

  function extensionFromContentType(contentType, url) {
    if (/png/i.test(contentType || "")) return "png";
    if (/webp/i.test(contentType || "")) return "webp";
    return filenameTools.extensionFromUrl(url, "image");
  }

  async function fetchBestThumbnail(videoId) {
    for (const candidate of thumbnailCandidates(videoId)) {
      try {
        const response = await fetch(candidate.url, { cache: "no-store" });
        const contentType = response.headers.get("content-type") || "";
        if (!response.ok || !contentType.startsWith("image/")) continue;
        const blob = await response.blob();
        if (!blob.size) continue;
        return {
          blob,
          ext: extensionFromContentType(contentType, candidate.url),
          url: candidate.url
        };
      } catch (error) {
        // Try the next thumbnail quality.
      }
    }
    throw new Error("No YouTube thumbnail was available for this video.");
  }

  function buildThumbnailItem(cardData, thumbnail) {
    const item = {
      id: cardData.videoId,
      ownerUsername: cardData.channelName || "youtube",
      takenAt: Math.floor(Date.now() / 1000),
      mediaType: "thumbnail",
      url: thumbnail.url,
      filename: `${cardData.videoId}.${thumbnail.ext}`,
      order: 1
    };
    return filenameTools.applyPattern([item], settings)[0];
  }

  function currentPageCardData() {
    const videoId = currentVideoId();
    return videoId
      ? {
          channelName: channelName(document),
          previewUrl: previewUrl(videoId),
          title: textFrom(document.querySelector("ytd-watch-metadata h1 yt-formatted-string")) || videoId,
          videoId
        }
      : null;
  }

  async function downloadCardThumbnail(cardData, busyControl) {
    if (!cardData || !cardData.videoId) {
      showToast({ title: "No video detected", detail: "Could not find a video for this thumbnail.", tone: "warning" });
      return;
    }

    if (busyControl && busyControl.setBusy) busyControl.setBusy(true);
    else if (busyControl) {
      busyControl.disabled = true;
      busyControl.classList.add("is-loading");
    }

    const toastId = showToast({ title: "Resolving thumbnail", detail: cardData.title || cardData.videoId, tone: "progress", progress: 12 }, 0);
    try {
      const thumbnail = await fetchBestThumbnail(cardData.videoId);
      const item = buildThumbnailItem(cardData, thumbnail);
      updateToast(toastId, { title: "Downloading thumbnail", detail: item.filename, tone: "progress", progress: 65 });
      const result = await downloader.saveBlobItem(item, thumbnail.blob);
      updateToast(toastId, {
        title: "Thumbnail saved",
        detail: result && result.directoryName ? `Saved to ${result.directoryName}` : item.filename,
        tone: "success",
        progress: null,
        timeoutMs: 3600
      });
    } catch (error) {
      updateToast(toastId, {
        title: "Thumbnail download failed",
        detail: error.message || "Could not download this thumbnail.",
        tone: "error",
        progress: null,
        timeoutMs: 5200
      });
    } finally {
      if (busyControl && busyControl.setBusy) busyControl.setBusy(false);
      else if (busyControl) {
        busyControl.disabled = false;
        busyControl.classList.remove("is-loading");
      }
    }
  }

  function ensureSelectionDock() {
    if (selectionDock) return;
    selectionDock = ui.createSelectionDock({
      clearSelection,
      downloadSelected
    });
    document.body.appendChild(selectionDock.element);
    syncSelectionUi();
  }

  function syncSelectionUi() {
    ensureSelectionDock();
    const items = Array.from(selected.values());
    selectionDock.update(items);
    cardControls.forEach((control, card) => {
      if (!card.isConnected) {
        cardControls.delete(card);
        return;
      }
      const cardData = control.cardData;
      control.setSelected(Boolean(cardData && selected.has(cardData.videoId)));
      card.classList.toggle("ig-bulk-youtube-card--selected", Boolean(cardData && selected.has(cardData.videoId)));
    });
  }

  function toggleSelect(cardData) {
    if (!cardData || !cardData.videoId || selectionBusy) return;
    if (selected.has(cardData.videoId)) selected.delete(cardData.videoId);
    else selected.set(cardData.videoId, cardData);
    syncSelectionUi();
  }

  function clearSelection() {
    if (selectionBusy) return;
    selected.clear();
    syncSelectionUi();
  }

  async function downloadSelected() {
    const items = Array.from(selected.values());
    if (!items.length || selectionBusy) return;

    selectionBusy = true;
    selectionDock.setBusy(true);
    const toastId = showToast({ title: "Resolving selected thumbnails", detail: `${items.length} selected`, tone: "progress", progress: 5 }, 0);
    let downloaded = 0;
    let failed = 0;

    try {
      for (let index = 0; index < items.length; index += 1) {
        const cardData = items[index];
        selectionDock.setProgress(`Resolving ${index + 1}/${items.length}`);
        updateToast(toastId, {
          detail: `Resolving ${index + 1}/${items.length}`,
          progress: Math.max(8, Math.round((index / items.length) * 35))
        });
        try {
          const thumbnail = await fetchBestThumbnail(cardData.videoId);
          const item = buildThumbnailItem(cardData, thumbnail);
          selectionDock.setProgress(`Downloading ${index + 1}/${items.length}`);
          await downloader.saveBlobItem(item, thumbnail.blob);
          downloaded += 1;
        } catch (error) {
          failed += 1;
        }
        updateToast(toastId, {
          title: "Downloading selected thumbnails",
          detail: `${index + 1}/${items.length} complete`,
          progress: Math.round(((index + 1) / items.length) * 100)
        });
      }

      updateToast(toastId, {
        title: failed ? "Thumbnail batch finished" : "Thumbnails saved",
        detail: `${downloaded} saved${failed ? `, ${failed} failed` : ""}`,
        tone: failed ? "warning" : "success",
        progress: null,
        timeoutMs: 5200
      });
      if (!failed) selected.clear();
      syncSelectionUi();
    } finally {
      selectionBusy = false;
      selectionDock.setBusy(false);
      selectionDock.setProgress("");
    }
  }

  function findMountTarget() {
    return (
      document.querySelector("#top-level-buttons-computed") ||
      document.querySelector("ytd-watch-metadata #actions") ||
      document.querySelector("ytd-watch-metadata")
    );
  }

  async function downloadTranscript(busyControl) {
    const videoId = currentVideoId();
    if (!videoId) {
      showToast({ title: "No video detected", detail: "Could not find a video on this page.", tone: "warning" });
      return;
    }

    const cardData = currentPageCardData();
    const videoTitle = cardData ? cardData.title : videoId;

    if (busyControl && busyControl.setTranscriptBusy) busyControl.setTranscriptBusy(true);

    const toastId = showToast({ title: "Extracting transcript", detail: videoTitle, tone: "progress", progress: 15 }, 0);
    try {
      const result = await transcript.extractTranscript(videoId);
      
      const item = {
        id: videoId,
        ownerUsername: cardData ? cardData.channelName : "youtube",
        takenAt: Math.floor(Date.now() / 1000),
        mediaType: "transcript",
        filename: `${videoTitle.replace(/[<>:"/\\|?*]/g, "_")}.txt`,
        order: 1
      };
      const processedItem = filenameTools.applyPattern([item], settings)[0];
      
      const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
      
      updateToast(toastId, { title: "Downloading transcript", detail: processedItem.filename, tone: "progress", progress: 65 });
      const downloadResult = await downloader.saveBlobItem(processedItem, blob);
      
      updateToast(toastId, {
        title: "Transcript saved",
        detail: downloadResult && downloadResult.directoryName ? `Saved to ${downloadResult.directoryName}` : processedItem.filename,
        tone: "success",
        progress: null,
        timeoutMs: 3600
      });
    } catch (error) {
      updateToast(toastId, {
        title: "Transcript download failed",
        detail: error.message || "Could not download transcript for this video.",
        tone: "error",
        progress: null,
        timeoutMs: 5200
      });
    } finally {
      if (busyControl && busyControl.setTranscriptBusy) busyControl.setTranscriptBusy(false);
    }
  }

  async function mountWatchControl(videoId) {
    const target = findMountTarget();
    if (!target) return false;
    if (!control) {
      control = ui.createYouTubeThumbnailControl({
        download: () => downloadCardThumbnail(currentPageCardData(), control),
        downloadTranscript: () => downloadTranscript(control)
      });
    }
    if (!control.element.isConnected || control.element.parentElement !== target) target.appendChild(control.element);
    
    lastVideoId = videoId;
    return true;
  }

  function unmountWatchControl() {
    if (control && control.element) control.element.remove();
    lastVideoId = "";
  }

  function cardRoots() {
    if (currentVideoId()) {
      const related = document.querySelector("#related") || document.querySelector("ytd-watch-next-secondary-results-renderer");
      if (!related) return [];
      return Array.from(related.querySelectorAll("ytd-compact-video-renderer"));
    }

    if (isHomeRoute() || isChannelRoute()) {
      return Array.from(
        document.querySelectorAll(
          [
            "ytd-rich-item-renderer",
            "ytd-video-renderer",
            "ytd-grid-video-renderer"
          ].join(",")
        )
      );
    }

    return [];
  }

  function cardDataFromRoot(card) {
    const link =
      card.querySelector("a#thumbnail[href*='/watch']") ||
      card.querySelector("a#video-title[href*='/watch']") ||
      card.querySelector("a[href*='/watch?v=']");
    const videoId = link ? videoIdFromHref(link.href) : "";
    if (!videoId) return null;

    const titleNode =
      card.querySelector("#video-title") ||
      card.querySelector("a#video-title-link") ||
      card.querySelector("h3 a") ||
      link;

    return {
      channelName: channelName(card),
      previewUrl: previewUrl(videoId),
      title: textFrom(titleNode) || videoId,
      videoId
    };
  }

  function thumbnailMountFromCard(card) {
    const thumbnail = card.querySelector("a#thumbnail[href*='/watch']") || card.querySelector("a[href*='/watch?v=']");
    if (!thumbnail) return null;
    return thumbnail.parentElement || thumbnail;
  }

  function decorateCard(card) {
    const cardData = cardDataFromRoot(card);
    const mount = thumbnailMountFromCard(card);
    if (!cardData || !mount) return;

    const existing = cardControls.get(card);
    if (existing && existing.cardData && existing.cardData.videoId === cardData.videoId) {
      existing.setSelected(selected.has(cardData.videoId));
      card.classList.toggle("ig-bulk-youtube-card--selected", selected.has(cardData.videoId));
      return;
    }

    if (existing) existing.element.remove();
    mount.querySelectorAll(".ig-bulk-youtube-card-controls").forEach((node) => node.remove());
    mount.classList.add("ig-bulk-youtube-card");

    const controlApi = ui.createCardControls(cardData, {
      download: (data, button) => downloadCardThumbnail(data, button),
      toggleSelect
    });
    controlApi.cardData = cardData;
    mount.appendChild(controlApi.element);
    controlApi.setSelected(selected.has(cardData.videoId));
    card.classList.toggle("ig-bulk-youtube-card--selected", selected.has(cardData.videoId));
    cardControls.set(card, controlApi);
  }

  function pruneCards() {
    cardControls.forEach((controlApi, card) => {
      if (card.isConnected) return;
      controlApi.element.remove();
      cardControls.delete(card);
    });
  }

  function destroyCardControls() {
    cardControls.forEach((controlApi, card) => {
      controlApi.element.remove();
      card.classList.remove("ig-bulk-youtube-card--selected");
    });
    document.querySelectorAll(".ig-bulk-youtube-card").forEach((node) => node.classList.remove("ig-bulk-youtube-card"));
    cardControls.clear();
  }

  function refreshCards() {
    if (!currentVideoId() && !isHomeRoute() && !isChannelRoute()) {
      destroyCardControls();
      if (!selectionBusy) selected.clear();
      syncSelectionUi();
      return;
    }
    pruneCards();
    cardRoots().forEach(decorateCard);
    syncSelectionUi();
  }

  function refresh() {
    const videoId = currentVideoId();
    if (videoId) {
      const mounted = mountWatchControl(videoId);
      if (!mounted && videoId !== lastVideoId) scheduleRefresh();
    } else {
      unmountWatchControl();
    }
    refreshCards();
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 140);
  }

  function shouldRefreshForNode(node) {
    return (
      node.matches &&
      (node.matches("ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-watch-metadata") ||
        node.querySelector("ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-watch-metadata"))
    );
  }

  async function init() {
    settings = await settingsStore.load();
    settingsStore.subscribe((nextSettings) => {
      settings = nextSettings;
    });
    ensureSelectionDock();
    refresh();

    document.addEventListener("yt-navigate-finish", scheduleRefresh);
    document.addEventListener("yt-page-data-updated", scheduleRefresh);
    window.addEventListener("popstate", scheduleRefresh);
    setInterval(() => {
      if (currentVideoId() !== lastVideoId || (lastVideoId && control && !control.element.isConnected)) scheduleRefresh();
    }, 1000);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.id && String(node.id).startsWith("ig-bulk")) continue;
          if (node.classList && String(node.className || "").includes("ig-bulk")) continue;
          if (shouldRefreshForNode(node)) {
            scheduleRefresh();
            return;
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  init();
})();
