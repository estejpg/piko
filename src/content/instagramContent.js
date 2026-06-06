(function () {
  const MSG = window.IG_BULK_MESSAGES;
  const resolver = window.IgBulkMediaResolver;
  const downloader = window.IgBulkDownloader;
  const settingsStore = window.IgBulkSettingsStore;
  const filenameTools = window.IgBulkFilename;

  let settings = { ...window.IG_BULK_DEFAULT_SETTINGS };
  let route = classifyRoute(location.pathname);
  let profileMenu = null;
  let feedButton = null;
  let timelineActions = null;
  let profileHoverButtons = null;
  let profileMultiSelect = null;
  let profileMultiSelectKey = "";
  let toastHost = null;
  let activeProfileMode = null;
  let thumbnailMode = false;
  let routeRefreshTimer = null;
  let contextualRefreshFrame = null;
  let profilePositionFrame = null;
  let lastRoutePathname = location.pathname;

  function normalizeSettings(nextSettings) {
    return settingsStore.normalize(nextSettings);
  }

  function classifyRoute(pathname) {
    if (!pathname || pathname === "/") return { type: "feed" };
    if (/^\/(?:stories|direct|accounts|challenge|oauth)\b/.test(pathname)) return { type: "excluded" };
    if (/^\/reels\/?$/.test(pathname)) return { type: "feed" };
    if (/^\/explore\b/.test(pathname)) return { type: "explore" };

    const postMatch = pathname.match(/^\/(?:p|reel|tv)\/([^/]+)/);
    if (postMatch) return { type: "post", shortcode: postMatch[1] };

    const profileMatch = pathname.match(/^\/([^/]+)(?:\/(reels|tagged|saved))?\/?$/);
    if (profileMatch) {
      return {
        type: profileMatch[2] === "reels" ? "profileReels" : "profile",
        username: profileMatch[1],
        tab: profileMatch[2] || "posts"
      };
    }

    return { type: "other" };
  }

  function isProfileRoute(currentRoute) {
    return currentRoute.type === "profile" || currentRoute.type === "profileReels";
  }

  function isFeedRoute(currentRoute) {
    return currentRoute.type === "feed";
  }

  function supportsPostActions(currentRoute) {
    return currentRoute.type === "feed" || currentRoute.type === "post";
  }

  function requestBridge(kind, payload) {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("Instagram page bridge timed out."));
      }, 5000);

      function onMessage(event) {
        if (event.source !== window || event.origin !== location.origin) return;
        const message = event.data || {};
        if (message.source !== MSG.BRIDGE_SOURCE || message.type !== MSG.RESPONSE_MEDIA || message.requestId !== requestId) return;

        clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        if (message.error) reject(new Error(message.error));
        else resolve(message.payload);
      }

      window.addEventListener("message", onMessage);
      window.postMessage(
        {
          source: MSG.CONTENT_SOURCE,
          type: MSG.REQUEST_MEDIA,
          requestId,
          kind,
          ...payload
        },
        location.origin
      );
    });
  }

  async function loadSettings() {
    settings = await settingsStore.load();
  }

  function saveSettingsPatch(patch) {
    settings = normalizeSettings({ ...settings, ...(patch || {}) });
    return settingsStore.patch(patch).then((nextSettings) => {
      settings = nextSettings;
      return settings;
    });
  }

  function handleSettingsChanged(nextSettings) {
    const previousSettings = settings;
    settings = normalizeSettings(nextSettings);

    const feedVisibilityChanged = Boolean(previousSettings.showFeedButton) !== Boolean(settings.showFeedButton);
    if (feedVisibilityChanged) mountUiForRoute();
    else refreshContextualActions();

    if (settings.selectedFolderName) setStatus(`Folder: ${settings.selectedFolderName}`);
  }

  function getToastHost() {
    if (!toastHost) toastHost = window.IgBulkToastHost.createToastHost();
    return toastHost;
  }

  function showToast(message, timeoutMs, options) {
    const toast = typeof message === "object" ? message : { title: message };
    return getToastHost().show({
      timeoutMs,
      ...toast,
      ...(options || {})
    });
  }

  function updateToast(id, options) {
    if (!id) return null;
    return getToastHost().update(id, options);
  }

  function setStatus(message) {
    if (profileMenu) profileMenu.setStatus(message);
    if (feedButton) feedButton.setStatus(message);
  }

  function applyFilenamePattern(items) {
    return filenameTools.applyPattern(items, settings);
  }

  function mountUiForRoute() {
    if (profileMenu && !isProfileRoute(route)) {
      cancelProfileMode("route-change");
      profileMenu.element.remove();
      profileMenu = null;
    }

    if (feedButton && (!isFeedRoute(route) || !settings.showFeedButton)) {
      feedButton.element.remove();
      feedButton = null;
    }

    if (timelineActions && !supportsPostActions(route)) {
      timelineActions.destroy();
      timelineActions = null;
    }

    if (profileHoverButtons && !isProfileRoute(route)) {
      profileHoverButtons.destroy();
      profileHoverButtons = null;
    }

    if (profileMultiSelect && !isProfileRoute(route)) {
      profileMultiSelect.destroy();
      profileMultiSelect = null;
      profileMultiSelectKey = "";
    }

    if (profileMultiSelect && isProfileRoute(route) && profileMultiSelectKey !== route.username) {
      profileMultiSelect.destroy();
      profileMultiSelect = null;
      profileMultiSelectKey = "";
    }

    if (isProfileRoute(route) && !profileMenu) {
      profileMenu = window.IgBulkProfileSideMenu.createProfileSideMenu({
        visible: () => toggleProfileMode("visible", (token) => downloadVisibleMedia("profile visible media", token)),
        profile: () => toggleProfileMode("profile", (token) => downloadProfileBulk("profile media", { token })),
        reels: () => toggleProfileMode("reels", (token) => downloadProfileBulk("profile reels", { reelsOnly: true, token })),
        thumbnail: () => toggleThumbnailMode(),
        cancel: () => cancelProfileMode("user"),
        folder: () => chooseFolder()
      });
      document.body.appendChild(profileMenu.element);
      if (profileMenu.setThumbnailMode) profileMenu.setThumbnailMode(thumbnailMode);
      updateProfileMenuPosition();
    }

    if (isFeedRoute(route) && settings.showFeedButton && !feedButton) {
      feedButton = window.IgBulkFeedTopButton.createFeedTopButton({
        current: () => downloadCurrentPostOrVisibleMedia(),
        folder: () => chooseFolder(),
        options: () => openOptions()
      });
      document.body.appendChild(feedButton.element);
    }

    if (supportsPostActions(route) && !timelineActions) {
      timelineActions = window.IgBulkTimelinePostActions.createTimelinePostActions({
        onDownloadArticle: (article, button) => downloadTimelineArticle(article, button)
      });
    }

    if (isProfileRoute(route) && !profileHoverButtons) {
      profileHoverButtons = window.IgBulkProfileHoverButtons.createProfileHoverButtons({
        onDownloadTile: (anchor, shortcode, button) => downloadProfileTile(anchor, shortcode, button)
      });
    }

    if (isProfileRoute(route) && !profileMultiSelect) {
      profileMultiSelect = window.IgBulkProfileMultiSelect.createProfileMultiSelect({
        isThumbnailMode: () => thumbnailMode,
        onDownloadSelected: (shortcodes, controls) => downloadSelectedProfileMedia(shortcodes, controls)
      });
      profileMultiSelectKey = route.username;
    }

    refreshContextualActions();
  }

  function refreshContextualActions() {
    if (timelineActions && supportsPostActions(route)) timelineActions.refresh();
    if (profileHoverButtons && isProfileRoute(route)) profileHoverButtons.refresh();
    if (profileMultiSelect && isProfileRoute(route)) profileMultiSelect.refresh();
  }

  function scheduleContextualRefresh() {
    if (contextualRefreshFrame) return;
    contextualRefreshFrame = requestAnimationFrame(() => {
      contextualRefreshFrame = null;
      refreshContextualActions();
    });
  }

  function updateProfileMenuPosition() {
    if (!profileMenu) return;
    if (window.matchMedia("(max-width: 760px)").matches) {
      profileMenu.element.style.top = "";
      return;
    }
    const target =
      document.querySelector("main header") ||
      document.querySelector("main article") ||
      document.querySelector("main") ||
      document.body;
    const rect = target.getBoundingClientRect();
    const top = Math.max(92, Math.min(rect.bottom + 14, window.innerHeight - 240));
    profileMenu.element.style.top = `${Math.round(top)}px`;
  }

  function scheduleProfileMenuPosition() {
    if (profilePositionFrame) return;
    profilePositionFrame = requestAnimationFrame(() => {
      profilePositionFrame = null;
      updateProfileMenuPosition();
    });
  }

  function clearProfileTemporaryUi() {
    if (profileMultiSelect && profileMultiSelect.clearSelection) profileMultiSelect.clearSelection();
    document.querySelectorAll(".ig-bulk-tile--selected").forEach((node) => node.classList.remove("ig-bulk-tile--selected"));
    document.querySelectorAll(".ig-bulk-tile-download.is-loading, .ig-bulk-inline-download.is-loading").forEach((node) => {
      node.classList.remove("is-loading");
      node.disabled = false;
      node.setAttribute("aria-disabled", "false");
    });
  }

  function isModeCancelled(token) {
    return Boolean(token && token.cancelled);
  }

  function assertModeActive(token) {
    if (isModeCancelled(token)) {
      const error = new Error("Mode cancelled.");
      error.name = "AbortError";
      throw error;
    }
  }

  function cancelProfileMode(reason) {
    if (!activeProfileMode) return;
    activeProfileMode.cancelled = true;
    if (activeProfileMode.abortController) activeProfileMode.abortController.abort();
    if (profileMenu && profileMenu.setActiveMode) profileMenu.setActiveMode(null);
    clearProfileTemporaryUi();
    setStatus("Cancelled");
    if (reason === "user") {
      showToast({ title: "Mode cancelled", detail: "Selection and temporary overlays were cleared.", tone: "warning" });
    }
  }

  async function toggleProfileMode(mode, task) {
    if (activeProfileMode && activeProfileMode.mode === mode) {
      cancelProfileMode("user");
      return;
    }

    if (activeProfileMode) cancelProfileMode("switch");

    const token = {
      abortController: new AbortController(),
      cancelled: false,
      mode
    };
    activeProfileMode = token;
    if (profileMenu && profileMenu.setActiveMode) profileMenu.setActiveMode(mode);
    setStatus(`${modeLabel(mode)} active`);

    try {
      await task(token);
    } catch (error) {
      if (!isModeCancelled(token) && error.name !== "AbortError") {
        showToast({ title: "Mode failed", detail: error.message || "Could not complete this action.", tone: "error" });
      }
    } finally {
      if (activeProfileMode === token) {
        activeProfileMode = null;
        if (profileMenu && profileMenu.setActiveMode) profileMenu.setActiveMode(null);
        clearProfileTemporaryUi();
      }
    }
  }

  function modeLabel(mode) {
    if (mode === "visible") return "Visible";
    if (mode === "profile") return "Profile";
    if (mode === "reels") return "Reels";
    return "Mode";
  }

  function toggleThumbnailMode() {
    thumbnailMode = !thumbnailMode;
    if (profileMenu && profileMenu.setThumbnailMode) profileMenu.setThumbnailMode(thumbnailMode);
    if (profileMultiSelect && profileMultiSelect.refresh) profileMultiSelect.refresh();
    setStatus(thumbnailMode ? "Thumbnails active" : "Thumbnails off");
    showToast({
      title: thumbnailMode ? "Thumbnail Mode on" : "Thumbnail Mode off",
      detail: thumbnailMode ? "Downloads will target poster and thumbnail images." : "Downloads will use full media again.",
      tone: "neutral",
      timeoutMs: 2800
    });
  }

  async function chooseFolder() {
    try {
      const handle = await downloader.chooseBulkDirectory();
      const folderName = handle && handle.name ? handle.name : "selected folder";
      await saveSettingsPatch({ selectedFolderName: folderName });
      setStatus(`Folder: ${folderName}`);
      showToast({ title: "Folder updated", detail: folderName, tone: "success" });
    } catch (error) {
      setStatus("Folder unavailable");
      showToast({ title: "Folder unavailable", detail: error.message || "Could not choose folder.", tone: "error" });
    }
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  async function resolvePostByShortcode(shortcode, options) {
    let post = null;
    try {
      post = await requestBridge("postByShortcode", { shortcode });
    } catch (error) {
      post = null;
    }

    if (!post) {
      try {
        post = await resolver.fetchPostFallback(shortcode);
      } catch (error) {
        post = null;
      }
    }

    return options && options.thumbnailOnly ? resolver.normalizePostThumbnails(post) : resolver.normalizePost(post);
  }

  function collectDomMediaWithin(root, options) {
    if (!root) return [];
    const nodes = Array.from(root.querySelectorAll("video, img"));
    const thumbnailOnly = Boolean(options && options.thumbnailOnly);
    return resolver.dedupeByUrl(
      nodes
        .map((node, index) => {
          const rect = node.getBoundingClientRect();
          if (rect.width < 80 || rect.height < 80) return null;
          const url = thumbnailOnly && node.tagName === "VIDEO" ? node.getAttribute("poster") : node.currentSrc || node.src;
          if (!url || url.startsWith("data:")) return null;
          return resolver.buildMediaItem({
            id: thumbnailOnly ? `${node.getAttribute("data-ig-bulk-media-id") || index}-thumbnail` : node.getAttribute("data-ig-bulk-media-id") || index,
            ownerUsername: resolver.usernameFromPath() || "instagram",
            takenAt: Math.floor(Date.now() / 1000),
            mediaType: thumbnailOnly ? "image" : node.tagName === "VIDEO" ? "video" : "image",
            url,
            order: index + 1
          });
        })
        .filter(Boolean)
    );
  }

  function shortcodeFromElement(root) {
    if (!root) return null;
    const directLink = root.matches && root.matches('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]') ? root : null;
    const link = directLink || root.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]');
    if (link) return resolver.shortcodeFromUrl(link.href);

    const current = resolver.shortcodeFromUrl(location.href);
    const isModalContext = root.closest && root.closest('[role="dialog"], [aria-modal="true"]');
    return isModalContext && current ? current : null;
  }

  async function downloadPostByShortcode(shortcode, label, fallbackRoot) {
    const thumbnailOnly = thumbnailMode;
    if (!shortcode) {
      const fallbackItems = applyFilenamePattern(collectDomMediaWithin(fallbackRoot, { thumbnailOnly }));
      return downloadMediaItems(fallbackItems, thumbnailOnly ? `${label || "media"} thumbnails` : label || "media");
    }

    let items = await resolvePostByShortcode(shortcode, { thumbnailOnly });
    if (!items.length) items = collectDomMediaWithin(fallbackRoot, { thumbnailOnly });
    return downloadMediaItems(applyFilenamePattern(items), thumbnailOnly ? `${label || "post"} thumbnails` : label || "post");
  }

  async function downloadMediaItems(items, label, controls, token) {
    if (!items.length) {
      setStatus("No media found");
      showToast({ title: "No media found", detail: "Could not find downloadable media for this item.", tone: "warning" });
      return;
    }

    if (items.length === 1) {
      await downloadSingleItem(items[0], `Downloaded ${label}.`, controls, token);
      return;
    }

    await downloadBulkItems(items, label, controls, token);
  }

  async function withButtonBusy(button, task) {
    if (button) {
      button.classList.add("is-loading");
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    }

    try {
      await task();
    } finally {
      if (button) {
        button.classList.remove("is-loading");
        button.disabled = false;
        button.setAttribute("aria-disabled", "false");
      }
    }
  }

  async function downloadTimelineArticle(article, button) {
    await withButtonBusy(button, () => downloadPostByShortcode(shortcodeFromElement(article), "post", article));
  }

  async function downloadProfileTile(anchor, shortcode, button) {
    await withButtonBusy(button, () => downloadPostByShortcode(shortcode, "media", anchor));
  }

  async function downloadSelectedProfileMedia(shortcodes, controls) {
    controls = controls || {};
    controls.setBusy = controls.setBusy || function () {};
    controls.setProgress = controls.setProgress || function () {};

    const uniqueShortcodes = Array.from(new Set(shortcodes.filter(Boolean)));
    const thumbnailOnly = thumbnailMode;
    if (!uniqueShortcodes.length) {
      showToast({ title: "Select media first", detail: "Choose one or more profile tiles to download.", tone: "warning" });
      return;
    }

    controls.setBusy(true);
    try {
      setStatus(`Resolving 0/${uniqueShortcodes.length}`);
      controls.setProgress(`Resolving 0/${uniqueShortcodes.length}`);
      const toastId = showToast(
        {
          title: "Resolving selected media",
          detail: `${uniqueShortcodes.length} selected item(s)`,
          tone: "progress",
          progress: 4
        },
        0
      );

      const allItems = [];
      let failed = 0;

      for (let index = 0; index < uniqueShortcodes.length; index += 1) {
        setStatus(`Resolving ${index + 1}/${uniqueShortcodes.length}`);
        controls.setProgress(`Resolving ${index + 1}/${uniqueShortcodes.length}`);
        updateToast(toastId, {
          detail: `Resolving ${index + 1}/${uniqueShortcodes.length}`,
          progress: ((index + 1) / uniqueShortcodes.length) * 40
        });
        try {
          const items = await resolvePostByShortcode(uniqueShortcodes[index], { thumbnailOnly });
          if (items.length) allItems.push(...items);
          else failed += 1;
        } catch (error) {
          failed += 1;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      const uniqueItems = applyFilenamePattern(resolver.dedupeByUrl(allItems));
      if (!uniqueItems.length) {
        setStatus("No media found");
        controls.setProgress("");
        updateToast(toastId, {
          title: "No media found",
          detail: "Could not resolve downloadable media for the selected items.",
          tone: "warning",
          progress: null,
          timeoutMs: 4500
        });
        return;
      }

      controls.setProgress(`Downloading ${uniqueItems.length} file(s)`);
      updateToast(toastId, {
        title: "Downloading selected media",
        detail: `${uniqueItems.length} file(s) ready`,
        tone: "progress",
        progress: 45
      });
      const selectedLabel = thumbnailOnly ? "selected media thumbnails" : "selected media";
      await downloadMediaItems(uniqueItems, failed ? `${selectedLabel} (${failed} unresolved)` : selectedLabel, controls);
      controls.setProgress("Done");
    } finally {
      controls.setBusy(false);
    }
  }

  function currentShortcode() {
    const fromLocation = resolver.shortcodeFromUrl(location.href);
    if (fromLocation) return fromLocation;

    const visibleLink = findMostVisibleLink();
    return visibleLink ? resolver.shortcodeFromUrl(visibleLink.href) : null;
  }

  function findMostVisibleLink() {
    const links = Array.from(document.querySelectorAll("a[href*='/p/'], a[href*='/reel/'], a[href*='/tv/']"));
    let best = null;
    let bestArea = 0;

    links.forEach((link) => {
      const rect = link.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const area = visibleWidth * visibleHeight;
      if (area > bestArea) {
        bestArea = area;
        best = link;
      }
    });

    return best;
  }

  async function downloadCurrentPostOrVisibleMedia() {
    setStatus("Resolving media...");
    const shortcode = currentShortcode();
    const thumbnailOnly = thumbnailMode;
    let items = [];

    if (shortcode) {
      await downloadPostByShortcode(shortcode, "current media", document);
      return;
    }

    items = applyFilenamePattern(thumbnailOnly ? resolver.collectVisibleDomThumbnails(document) : resolver.collectVisibleDomMedia());
    await downloadMediaItems(items.slice(0, 1), thumbnailOnly ? "current media thumbnails" : "current media");
  }

  async function downloadVisibleMedia(label, token) {
    assertModeActive(token);
    const thumbnailOnly = thumbnailMode;
    const items = applyFilenamePattern(thumbnailOnly ? resolver.collectVisibleDomThumbnails(document) : resolver.collectVisibleDomMedia());
    if (!items.length) {
      showToast({ title: "No visible media found", detail: thumbnailOnly ? "Try scrolling until thumbnails are visible and downloading again." : "Try scrolling the profile grid and downloading again.", tone: "warning" });
      setStatus("No media found");
      return;
    }

    if (items.length === 1) {
      await downloadSingleItem(items[0], `Downloaded ${thumbnailOnly ? "visible media thumbnails" : "visible media"}`, null, token);
      return;
    }

    await downloadBulkItems(items, thumbnailOnly ? `${label || "visible media"} thumbnails` : label || "visible media", null, token);
  }

  async function downloadProfileBulk(label, options) {
    const token = options && options.token;
    const thumbnailOnly = thumbnailMode;
    assertModeActive(token);
    setStatus("Collecting posts...");
    await requestBridge("markMediaIds", {}).catch(() => {});

    let shortcodes = resolver.collectProfileShortcodes();
    if (options && options.reelsOnly) {
      shortcodes = shortcodes.filter((shortcode) => {
        const anchor = document.querySelector(`a[href*="/reel/${shortcode}"]`);
        return Boolean(anchor);
      });
    }

    if (!shortcodes.length) {
      const domItems = thumbnailOnly ? resolver.collectVisibleDomThumbnails(document) : resolver.collectVisibleDomMedia();
      if (domItems.length) return downloadBulkItems(applyFilenamePattern(domItems), thumbnailOnly ? `${label} thumbnails` : label, null, token);
      setStatus("No posts found");
      showToast({ title: "No posts found", detail: "No downloadable profile media was found on the current page.", tone: "warning" });
      return;
    }

    const maxItems = Math.min(shortcodes.length, 36);
    const allItems = [];

    for (let index = 0; index < maxItems; index += 1) {
      assertModeActive(token);
      setStatus(`Resolving ${index + 1}/${maxItems}`);
      try {
        const mediaItems = await resolvePostByShortcode(shortcodes[index], { thumbnailOnly });
        allItems.push(...mediaItems);
      } catch (error) {
        // Continue; a profile grid may contain private, removed, or rate-limited media.
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    assertModeActive(token);
    const uniqueItems = applyFilenamePattern(resolver.dedupeByUrl(allItems));
    if (!uniqueItems.length) {
      setStatus("No downloadable URLs");
      showToast({ title: "No downloadable URLs", detail: "Could not resolve media URLs for this profile.", tone: "warning" });
      return;
    }

    await downloadBulkItems(uniqueItems, thumbnailOnly ? `${label || "profile media"} thumbnails` : label || "profile media", null, token);
  }

  async function downloadSingleItem(item, doneMessage, controls, token) {
    assertModeActive(token);
    const toastId = showToast({ title: "Downloading media", detail: item.filename || "Instagram media", tone: "progress", progress: 8 }, 0);
    try {
      setStatus("Downloading...");
      if (controls && controls.setProgress) controls.setProgress("Downloading 1 file");
      const result = await downloader.downloadSingle(
        item,
        ({ loaded, total }) => {
          if (isModeCancelled(token)) return;
          if (total) {
            const percent = Math.round((loaded / total) * 100);
            setStatus(`${percent}%`);
            if (controls && controls.setProgress) controls.setProgress(`${percent}% complete`);
            updateToast(toastId, { detail: `${percent}% complete`, progress: percent });
          }
        },
        token && { signal: token.abortController.signal }
      );
      assertModeActive(token);
      setStatus("Done");
      if (controls && controls.setProgress) controls.setProgress("Done");
      updateToast(toastId, {
        title: doneMessage || "Download complete",
        detail: result && result.directoryName ? `Saved to ${result.directoryName}` : item.filename || "",
        tone: "success",
        progress: null,
        timeoutMs: 3600
      });
    } catch (error) {
      if (error.name === "AbortError" || isModeCancelled(token)) {
        setStatus("Cancelled");
        updateToast(toastId, { title: "Download cancelled", detail: "No further files will be downloaded.", tone: "warning", progress: null, timeoutMs: 3200 });
      } else {
        setStatus("Download failed");
        updateToast(toastId, { title: "Download failed", detail: error.message || "Download failed.", tone: "error", progress: null, timeoutMs: 5000 });
      }
    }
  }

  async function downloadBulkItems(items, label, controls, token) {
    assertModeActive(token);
    const toastId = showToast({ title: `Preparing ${label}`, detail: `${items.length} item(s)`, tone: "progress", progress: 3 }, 0);
    try {
      setStatus(`0/${items.length}`);
      if (controls && controls.setProgress) controls.setProgress(`0/${items.length}`);
      const result = await downloader.downloadBulk(items, {
        isCancelled() {
          return isModeCancelled(token);
        },
        onBatchProgress(progress) {
          if (isModeCancelled(token)) return;
          const percent = Math.round((progress.completed / progress.total) * 100);
          setStatus(`${progress.completed}/${progress.total}`);
          if (controls && controls.setProgress) controls.setProgress(`${progress.completed}/${progress.total} downloaded`);
          updateToast(toastId, {
            title: `Downloading ${label}`,
            detail: `${progress.completed}/${progress.total} complete, ${progress.skipped} skipped`,
            tone: "progress",
            progress: percent
          });
        },
        signal: token && token.abortController.signal
      });
      assertModeActive(token);
      setStatus("Done");
      updateToast(toastId, {
        title: `Saved to ${result.directoryName}`,
        detail: `${result.downloaded} new, ${result.skipped} skipped, ${result.failed} failed`,
        tone: result.failed ? "warning" : "success",
        progress: null,
        timeoutMs: 5200
      });
    } catch (error) {
      if (error.name === "AbortError" || isModeCancelled(token)) {
        setStatus("Cancelled");
        updateToast(toastId, { title: "Download cancelled", detail: "Selection and temporary UI were cleared.", tone: "warning", progress: null, timeoutMs: 3200 });
      } else {
        setStatus("Bulk failed");
        updateToast(toastId, { title: "Bulk download failed", detail: error.message || "Bulk download failed.", tone: "error", progress: null, timeoutMs: 5200 });
      }
    }
  }

  function scheduleRouteRefresh() {
    clearTimeout(routeRefreshTimer);
    routeRefreshTimer = setTimeout(() => {
      const pathname = location.pathname;
      if (pathname === lastRoutePathname) {
        scheduleContextualRefresh();
        return;
      }
      lastRoutePathname = pathname;
      const nextRoute = classifyRoute(location.pathname);
      const changed = JSON.stringify(nextRoute) !== JSON.stringify(route);
      route = nextRoute;
      mountUiForRoute();
      updateProfileMenuPosition();
      refreshContextualActions();
      if (changed) requestBridge("markMediaIds", {}).catch(() => {});
    }, 120);
  }

  function observePageChanges() {
    const observer = new MutationObserver((records) => {
      if (location.pathname !== lastRoutePathname) {
        scheduleRouteRefresh();
        return;
      }

      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.classList && node.classList.contains("ig-bulk-toast")) continue;
          if (node.id && String(node.id).startsWith("ig-bulk")) continue;
          if (
            node.matches &&
            (node.matches('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"], article, [role="dialog"], [aria-modal="true"]') ||
              node.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"], article, [role="dialog"], [aria-modal="true"]'))
          ) {
            scheduleContextualRefresh();
            return;
          }
        }
      }
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

    window.addEventListener("resize", scheduleProfileMenuPosition);
    window.addEventListener("popstate", scheduleRouteRefresh);
    window.addEventListener("locationchange", scheduleRouteRefresh);

    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== location.origin) return;
      const message = event.data || {};
      if (message.source === MSG.BRIDGE_SOURCE && message.type === MSG.ROUTE_CHANGE) scheduleRouteRefresh();
    });

    settingsStore.subscribe(handleSettingsChanged);
  }

  async function init() {
    await loadSettings();
    requestBridge("markMediaIds", {}).catch(() => {});
    mountUiForRoute();
    observePageChanges();
  }

  init();
})();
