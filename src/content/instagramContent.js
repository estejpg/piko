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
  let storyActions = null;
  let timelineActions = null;
  let profileHoverButtons = null;
  let profileMultiSelect = null;
  let profileMultiSelectKey = "";
  let toastHost = null;
  let shortcutController = null;
  let activeProfileMode = null;
  let selectionMode = false;
  let routeRefreshTimer = null;
  let contextualRefreshFrame = null;
  let lastRoutePathname = location.pathname;

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeSettings(nextSettings) {
    return settingsStore.normalize(nextSettings);
  }

  function classifyRoute(pathname) {
    if (!pathname || pathname === "/") return { type: "feed" };
    if (/^\/(?:direct|accounts|challenge|oauth)\b/.test(pathname)) return { type: "excluded" };

    const storyRoute = resolver.parseStoryRoute ? resolver.parseStoryRoute(pathname) : null;
    if (storyRoute) return storyRoute;

    if (/^\/stories\b/.test(pathname)) return { type: "excluded" };
    if (/^\/reels\/?$/.test(pathname)) return { type: "feed" };
    if (/^\/explore\b/.test(pathname)) return { type: "explore" };

    // /reels/{code} is the reels feed with a focused reel; treat it as a post route.
    const postMatch = pathname.match(/^\/(?:p|reels?|tv)\/([^/]+)/);
    if (postMatch) return { type: "post", shortcode: postMatch[1] };

    const profileMatch = pathname.match(/^\/([^/]+)(?:\/(reels|tagged|saved))?\/?$/);
    if (profileMatch) {
      return {
        type: "profile",
        username: profileMatch[1],
        tab: profileMatch[2] || "posts"
      };
    }

    return { type: "other" };
  }

  function isStoryRoute(currentRoute) {
    return Boolean(currentRoute && currentRoute.type === "story");
  }

  function isProfileRoute(currentRoute) {
    return currentRoute.type === "profile";
  }

  function supportsGridTileActions(currentRoute) {
    return isProfileRoute(currentRoute) || currentRoute.type === "explore";
  }

  function supportsGridMultiSelect(currentRoute) {
    return supportsGridTileActions(currentRoute);
  }

  function gridMultiSelectKey(currentRoute) {
    if (currentRoute.type === "explore") return "explore";
    if (isProfileRoute(currentRoute)) return currentRoute.username || currentRoute.type;
    return "";
  }

  function isFeedRoute(currentRoute) {
    return currentRoute.type === "feed";
  }

  function shouldShowPageMenu(currentRoute) {
    if (currentRoute.type === "explore") return true;
    return isFeedRoute(currentRoute) && settings.showFeedButton;
  }

  function supportsPostActions(currentRoute) {
    // Explore grids are owned by ProfileHoverButtons; timeline overlays are for feed/post/modals.
    // Opening a post from Explore typically navigates to /p|reel/, which enables timeline there.
    return currentRoute.type === "feed" || currentRoute.type === "post";
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

    if (shortcutController) shortcutController.setEnabled(settings.enableKeyboardShortcuts);

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

  function isRateLimited(error) {
    return Boolean(error && error.code === "RATE_LIMITED");
  }

  function notifyRateLimited() {
    setStatus("Rate limited");
    showToast({
      title: "Instagram is limiting requests",
      detail: "Too many requests right now. Please wait a few minutes and try again.",
      tone: "warning",
      timeoutMs: 5600
    });
  }

  function notifyResolutionFailure(detail) {
    if (!settings.showReliabilityToasts) return null;
    return showToast({
      title: "Could not resolve media",
      detail: detail || "Instagram's API and on-page fallbacks returned no media.",
      tone: "health"
    });
  }

  function notifyDomFallback(detail) {
    if (!settings.showReliabilityToasts) return;
    showToast({
      title: "Used on-page media fallback",
      detail: detail || "",
      tone: "neutral",
      timeoutMs: 2400
    });
  }

  function setStatus(message) {
    if (profileMenu) profileMenu.setStatus(message);
    if (feedButton) feedButton.setStatus(message);
    if (storyActions) storyActions.setStatus(message);
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

    if (storyActions && !isStoryRoute(route)) {
      storyActions.element.remove();
      storyActions = null;
    }

    if (feedButton && !shouldShowPageMenu(route)) {
      feedButton.element.remove();
      feedButton = null;
    }

    if (feedButton && shouldShowPageMenu(route)) {
      const hasSelectAction = Boolean(feedButton.element.querySelector('button[data-action="select"]'));
      if (hasSelectAction !== supportsGridMultiSelect(route)) {
        feedButton.element.remove();
        feedButton = null;
      }
    }

    if (timelineActions && !supportsPostActions(route)) {
      timelineActions.destroy();
      timelineActions = null;
    }

    // Defense-in-depth for Explore/profile grids: purge any leftover timeline Saves that
    // may have survived a SPA navigation before destroy() ran.
    if (!supportsPostActions(route)) {
      document.querySelectorAll(".ig-bulk-timeline-download").forEach((button) => {
        const container = button.closest(".ig-bulk-timeline-media") || button.parentElement;
        button.remove();
        if (container) {
          container.classList.remove("ig-bulk-timeline-media");
          if (!container.querySelector(".ig-bulk-tile-download, .ig-bulk-tile-select")) {
            container.classList.remove("ig-bulk-tile");
          }
        }
      });
    }

    if (profileHoverButtons && !supportsGridTileActions(route)) {
      profileHoverButtons.destroy();
      profileHoverButtons = null;
    }

    const nextMultiSelectKey = gridMultiSelectKey(route);

    if (profileMultiSelect && !supportsGridMultiSelect(route)) {
      selectionMode = false;
      profileMultiSelect.destroy();
      profileMultiSelect = null;
      profileMultiSelectKey = "";
    }

    if (profileMultiSelect && supportsGridMultiSelect(route) && profileMultiSelectKey !== nextMultiSelectKey) {
      profileMultiSelect.destroy();
      profileMultiSelect = null;
      profileMultiSelectKey = "";
    }

    if (isProfileRoute(route) && !profileMenu) {
      profileMenu = window.IgBulkProfileSideMenu.createProfileSideMenu({
        visible: () => toggleProfileMode("visible", (token) => downloadVisibleMedia("visible media", token)),
        profile: () => toggleProfileMode("profile", (token) => downloadProfileBulk("profile media", { token })),
        select: () => toggleSelectionMode(),
        cancel: () => cancelProfileMode("user"),
        folder: () => chooseFolder()
      });
      document.body.appendChild(profileMenu.element);
      if (profileMenu.setSelectionMode) profileMenu.setSelectionMode(selectionMode);
    }

    if (shouldShowPageMenu(route) && !feedButton) {
      feedButton = window.IgBulkFeedTopButton.createFeedTopButton({
        current: () => downloadCurrentPostOrVisibleMedia(),
        select: supportsGridMultiSelect(route) ? () => toggleSelectionMode() : null,
        folder: () => chooseFolder(),
        options: () => openOptions()
      });
      document.body.appendChild(feedButton.element);
      if (feedButton.setSelectionMode) feedButton.setSelectionMode(selectionMode);
    }

    if (isStoryRoute(route) && !storyActions && window.IgBulkStoryViewerActions) {
      storyActions = window.IgBulkStoryViewerActions.createStoryViewerActions({
        current: () => downloadStoryMedia({ all: false }),
        all: () => downloadStoryMedia({ all: true }),
        folder: () => chooseFolder()
      });
      document.body.appendChild(storyActions.element);
    }

    if (supportsPostActions(route) && !timelineActions) {
      timelineActions = window.IgBulkTimelinePostActions.createTimelinePostActions({
        onDownloadArticle: (article, button) => downloadTimelineArticle(article, button)
      });
    }

    if (supportsGridTileActions(route) && !profileHoverButtons) {
      profileHoverButtons = window.IgBulkProfileHoverButtons.createProfileHoverButtons({
        onDownloadTile: (anchor, shortcode, button) => downloadProfileTile(anchor, shortcode, button)
      });
    }

    if (supportsGridMultiSelect(route) && !profileMultiSelect) {
      profileMultiSelect = window.IgBulkProfileMultiSelect.createProfileMultiSelect({
        onExitSelectionMode: () => setSelectionMode(false),
        onSelectionModeChanged: (enabled) => {
          selectionMode = Boolean(enabled);
          if (profileMenu && profileMenu.setSelectionMode) profileMenu.setSelectionMode(selectionMode);
          if (feedButton && feedButton.setSelectionMode) feedButton.setSelectionMode(selectionMode);
        },
        onDownloadSelected: (shortcodes, controls) => downloadSelectedProfileMedia(shortcodes, controls)
      });
      profileMultiSelectKey = nextMultiSelectKey;
      profileMultiSelect.setActive(selectionMode);
    }

    refreshContextualActions();
  }

  function refreshContextualActions() {
    if (timelineActions && supportsPostActions(route)) timelineActions.refresh();
    if (profileHoverButtons && supportsGridTileActions(route)) profileHoverButtons.refresh();
    if (profileMultiSelect && supportsGridMultiSelect(route)) profileMultiSelect.refresh();
  }

  function scheduleContextualRefresh() {
    if (contextualRefreshFrame) return;
    contextualRefreshFrame = requestAnimationFrame(() => {
      contextualRefreshFrame = null;
      refreshContextualActions();
    });
  }

  function setSelectionMode(enabled) {
    selectionMode = Boolean(enabled) && supportsGridMultiSelect(route);
    if (profileMultiSelect && profileMultiSelect.setActive) profileMultiSelect.setActive(selectionMode);
    if (profileMenu && profileMenu.setSelectionMode) profileMenu.setSelectionMode(selectionMode);
    if (feedButton && feedButton.setSelectionMode) feedButton.setSelectionMode(selectionMode);
    if (selectionMode) setStatus("Select media");
  }

  function toggleSelectionMode() {
    setSelectionMode(!selectionMode);
  }

  function clearProfileTemporaryUi() {
    if (profileMultiSelect && profileMultiSelect.clearSelection) profileMultiSelect.clearSelection();
    document.querySelectorAll(".ig-bulk-tile--selected").forEach((node) => node.classList.remove("ig-bulk-tile--selected"));
    document.querySelectorAll(".ig-bulk-tile-download.is-loading").forEach((node) => {
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
        if (isRateLimited(error)) notifyRateLimited();
        else showToast({ title: "Mode failed", detail: error.message || "Could not complete this action.", tone: "error" });
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
    return "Mode";
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

  function findAnchorForShortcode(shortcode) {
    return Array.from(
      document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"], main a[href*="/tv/"]')
    ).find((candidate) => resolver.shortcodeFromUrl(candidate.href) === shortcode);
  }

  // Resolve one post/reel to downloadable items:
  // shortcode -> media id -> REST info API, then marked media id, then rendered DOM.
  async function resolveMediaForElement(shortcode, fallbackRoot) {
    if (shortcode) {
      try {
        const items = await resolver.fetchPostItems(shortcode);
        if (items.length) return { items, source: "api" };
      } catch (error) {
        if (isRateLimited(error)) return { items: [], source: "none", rateLimited: true };
      }
    }

    const mediaId = resolver.mediaIdFromElement(fallbackRoot);
    if (mediaId) {
      try {
        const items = await resolver.fetchMediaItemsById(mediaId);
        if (items.length) return { items, source: "api" };
      } catch (error) {
        if (isRateLimited(error)) return { items: [], source: "none", rateLimited: true };
      }
    }

    const domItems = resolver.collectDomMediaWithin(fallbackRoot);
    return { items: domItems, source: domItems.length ? "dom" : "none" };
  }

  async function downloadPostByShortcode(shortcode, label, fallbackRoot) {
    const resolved = await resolveMediaForElement(shortcode, fallbackRoot);
    if (resolved.rateLimited && !resolved.items.length) {
      notifyRateLimited();
      return;
    }

    if (resolved.source === "dom") notifyDomFallback();

    const patterned = applyFilenamePattern(resolved.items);
    if (!patterned.length) {
      notifyResolutionFailure();
      return downloadMediaItems(patterned, label || "post", null, null, { resolutionExhausted: true });
    }

    return downloadMediaItems(patterned, label || "post");
  }

  // Resolve a list of shortcodes through the REST API with per-item DOM fallback.
  // Stops early when cancelled or rate limited.
  async function resolveShortcodeList(shortcodes, options) {
    const token = options && options.token;
    const onProgress = (options && options.onProgress) || function () {};
    const allItems = [];
    let failed = 0;
    let rateLimited = false;
    let usedDomFallback = false;

    for (let index = 0; index < shortcodes.length; index += 1) {
      if (isModeCancelled(token)) break;
      onProgress(index + 1, shortcodes.length);

      const shortcode = shortcodes[index];
      let items = [];
      try {
        items = await resolver.fetchPostItems(shortcode);
      } catch (error) {
        if (isRateLimited(error)) {
          rateLimited = true;
          break;
        }
      }

      if (!items.length) {
        items = resolver.collectDomMediaWithin(findAnchorForShortcode(shortcode));
        if (items.length) usedDomFallback = true;
      }

      if (items.length) allItems.push(...items);
      else failed += 1;

      if (index < shortcodes.length - 1) await delay(250);
    }

    return { items: resolver.dedupeByUrl(allItems), failed, rateLimited, usedDomFallback };
  }

  async function downloadStoryMedia(options) {
    const all = Boolean(options && options.all);
    const current = isStoryRoute(route) ? route : resolver.parseStoryRoute(location.pathname);
    if (!current) {
      notifyResolutionFailure("Open a story viewer to download Stories.");
      return;
    }

    if (storyActions && storyActions.setBusy) storyActions.setBusy(true);
    setStatus(all ? "Resolving story reel..." : "Resolving story...");

    try {
      let items = [];
      let usedDomFallback = false;
      let rateLimited = false;

      try {
        items = await resolver.fetchStoryItems({
          username: current.username,
          highlightId: current.highlightId,
          mediaId: current.mediaId,
          all
        });
      } catch (error) {
        rateLimited = isRateLimited(error);
        items = [];
      }

      if (!items.length) {
        items = resolver.collectVisibleStoryDomMedia(current.username);
        usedDomFallback = Boolean(items.length);
      }

      if (!items.length) {
        if (rateLimited) notifyRateLimited();
        else notifyResolutionFailure("Story API and on-page fallbacks returned no media.");
        setStatus("No story media");
        return;
      }

      if (usedDomFallback) notifyDomFallback("Story data was unavailable for this item.");

      const patterned = applyFilenamePattern(items);
      const label = all ? "story reel" : "story item";

      // Prefer sequential browser downloads for multi-item Stories when no folder
      // handle is already granted, so All does not force a directory picker.
      if (patterned.length > 1) {
        let hasFolder = false;
        try {
          const handle = await downloader.getStoredDirectoryHandle();
          if (handle && handle.queryPermission) {
            hasFolder = (await handle.queryPermission({ mode: "readwrite" })) === "granted";
          } else {
            hasFolder = Boolean(handle);
          }
        } catch (error) {
          hasFolder = false;
        }

        if (!hasFolder) {
          setStatus(`Downloading 0/${patterned.length}`);
          const toastId = showToast(
            { title: `Downloading ${label}`, detail: `${patterned.length} item(s)`, tone: "progress", progress: 4 },
            0
          );
          let downloaded = 0;
          let failed = 0;
          for (let index = 0; index < patterned.length; index += 1) {
            try {
              await downloader.downloadSingle(patterned[index], null, { source: "instagram" });
              downloaded += 1;
            } catch (error) {
              failed += 1;
            }
            setStatus(`${downloaded}/${patterned.length}`);
            updateToast(toastId, {
              detail: `${downloaded}/${patterned.length} complete`,
              progress: Math.round(((index + 1) / patterned.length) * 100)
            });
            await delay(200);
          }
          updateToast(toastId, {
            title: failed ? "Story reel finished" : "Story reel saved",
            detail: `${downloaded} saved${failed ? `, ${failed} failed` : ""}`,
            tone: failed ? "warning" : "success",
            progress: null,
            timeoutMs: 4200
          });
          setStatus("Done");
          return;
        }
      }

      await downloadMediaItems(patterned, label);
    } finally {
      if (storyActions && storyActions.setBusy) storyActions.setBusy(false);
    }
  }

  async function downloadMediaItems(items, label, controls, token, options) {
    if (!items.length) {
      setStatus("No media found");
      const tone = options && options.resolutionExhausted ? "health" : "warning";
      showToast({ title: "No media found", detail: "Could not find downloadable media for this item.", tone });
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

  function shortcodeFromElement(root) {
    if (!root) return null;
    const directLink = root.matches && root.matches('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]') ? root : null;
    const link = directLink || root.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]');
    if (link) return resolver.shortcodeFromUrl(link.href);

    const current = resolver.shortcodeFromUrl(location.href);
    const isModalContext = root.closest && root.closest('[role="dialog"], [aria-modal="true"]');
    return isModalContext && current ? current : null;
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
    if (!uniqueShortcodes.length) {
      showToast({ title: "Select media first", detail: "Choose one or more tiles to download.", tone: "warning" });
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

      const resolved = await resolveShortcodeList(uniqueShortcodes, {
        onProgress(done, total) {
          setStatus(`Resolving ${done}/${total}`);
          controls.setProgress(`Resolving ${done}/${total}`);
          updateToast(toastId, {
            detail: `Resolving ${done}/${total}`,
            progress: (done / total) * 40
          });
        }
      });

      if (resolved.usedDomFallback) notifyDomFallback();

      const uniqueItems = applyFilenamePattern(resolved.items);
      if (!uniqueItems.length) {
        setStatus("No media found");
        controls.setProgress("");
        updateToast(toastId, {
          title: resolved.rateLimited ? "Instagram is limiting requests" : "No media found",
          detail: resolved.rateLimited
            ? "Too many requests right now. Please wait a few minutes and try again."
            : "Could not resolve downloadable media for the selected items.",
          tone: resolved.rateLimited ? "warning" : "health",
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
      const unresolved = resolved.failed + (resolved.rateLimited ? 1 : 0);
      await downloadMediaItems(uniqueItems, unresolved ? `selected media (${unresolved} unresolved)` : "selected media", controls);
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

    if (shortcode) {
      await downloadPostByShortcode(shortcode, "current media", document);
      return;
    }

    const items = applyFilenamePattern(resolver.collectVisibleDomMedia());
    await downloadMediaItems(items.slice(0, 1), "current media");
  }

  async function downloadVisibleMedia(label, token) {
    assertModeActive(token);
    setStatus("Collecting visible media...");

    // Resolve the visible tiles through the API so carousels and full-quality
    // media are included, not just the preview images rendered in the grid.
    const shortcodes = resolver.collectProfileShortcodes({ visibleOnly: true });
    let items = [];
    let rateLimited = false;

    if (shortcodes.length) {
      const resolved = await resolveShortcodeList(shortcodes, {
        token,
        onProgress(done, total) {
          setStatus(`Resolving ${done}/${total}`);
        }
      });
      items = resolved.items;
      rateLimited = resolved.rateLimited;
      if (resolved.usedDomFallback && items.length) notifyDomFallback();
    }

    assertModeActive(token);

    if (!items.length) items = resolver.collectVisibleDomMedia();

    if (!items.length) {
      if (rateLimited) {
        notifyRateLimited();
        return;
      }
      showToast({ title: "No visible media found", detail: "Try scrolling the grid and downloading again.", tone: "warning" });
      setStatus("No media found");
      return;
    }

    const patterned = applyFilenamePattern(items);
    if (patterned.length === 1) {
      await downloadSingleItem(patterned[0], "Downloaded visible media", null, token);
      return;
    }

    await downloadBulkItems(patterned, label || "visible media", null, token);
  }

  // Bulk profile download: paginate Instagram's profile feed API and download
  // everything (photos, videos, reels, and every carousel child).
  async function downloadProfileBulk(label, options) {
    const token = options && options.token;
    assertModeActive(token);

    const username = (isProfileRoute(route) && route.username) || resolver.usernameFromPath();
    let items = [];
    let rateLimited = false;

    if (username) {
      setStatus("Collecting posts...");
      const toastId = showToast(
        { title: "Collecting profile media", detail: "Fetching posts...", tone: "progress", progress: 3 },
        0
      );

      let totalPosts = 0;
      try {
        try {
          const user = await resolver.fetchUserInfo(username);
          totalPosts = (user && user.totalPosts) || 0;
        } catch (error) {
          if (isRateLimited(error)) throw error;
          // Profile info is only used for progress; pagination can proceed without it.
        }

        let maxId = "";
        let pages = 0;
        do {
          assertModeActive(token);
          const page = await resolver.fetchProfileFeedPage(username, maxId);
          items.push(...page.items);
          maxId = page.nextMaxId;
          pages += 1;
          setStatus(`Collected ${items.length}`);
          updateToast(toastId, {
            detail: totalPosts
              ? `${items.length} file(s) from ~${totalPosts} posts`
              : `${items.length} file(s) collected`,
            progress: totalPosts ? Math.min(90, Math.round((pages * 12 * 90) / Math.max(totalPosts, 1))) : 20
          });
          if (maxId) await delay(400);
        } while (maxId);

        updateToast(toastId, {
          title: "Collection complete",
          detail: `${items.length} file(s) ready`,
          tone: "progress",
          progress: 95,
          timeoutMs: 2400
        });
      } catch (error) {
        if (error.name === "AbortError" || isModeCancelled(token)) {
          updateToast(toastId, { title: "Collection cancelled", detail: "", tone: "warning", progress: null, timeoutMs: 2600 });
          throw error;
        }
        rateLimited = isRateLimited(error);
        updateToast(toastId, {
          title: items.length ? "Collection interrupted" : "Collection failed",
          detail: items.length ? `Continuing with ${items.length} collected file(s).` : "",
          tone: "warning",
          progress: null,
          timeoutMs: 3600
        });
      }
    }

    // Fallback when the feed API is unavailable: resolve the tiles already on the page.
    if (!items.length) {
      const shortcodes = resolver.collectProfileShortcodes();
      if (shortcodes.length && !rateLimited) {
        const resolved = await resolveShortcodeList(shortcodes, {
          token,
          onProgress(done, total) {
            setStatus(`Resolving ${done}/${total}`);
          }
        });
        items = resolved.items;
        rateLimited = resolved.rateLimited;
        if (resolved.usedDomFallback && items.length) notifyDomFallback();
      }
    }

    if (!items.length) items = resolver.collectVisibleDomMedia();

    assertModeActive(token);

    if (!items.length) {
      if (rateLimited) {
        notifyRateLimited();
        return;
      }
      setStatus("No posts found");
      showToast({ title: "No posts found", detail: "No downloadable profile media was found.", tone: "warning" });
      return;
    }

    const uniqueItems = applyFilenamePattern(resolver.dedupeByUrl(items));
    await downloadBulkItems(uniqueItems, label || "profile media", null, token);
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
        {
          source: "instagram",
          signal: token && token.abortController.signal
        }
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
        source: "instagram",
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
      if (changed && selectionMode) setSelectionMode(false);
      route = nextRoute;
      mountUiForRoute();
      refreshContextualActions();
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
            (node.matches('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"], article, video, [role="dialog"], [aria-modal="true"]') ||
              node.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"], article, video, [role="dialog"], [aria-modal="true"]'))
          ) {
            scheduleContextualRefresh();
            return;
          }
        }
      }
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

    window.addEventListener("scroll", scheduleContextualRefresh, { passive: true });
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
    shortcutController = window.IgBulkShortcuts.createShortcutController({
      enabled: settings.enableKeyboardShortcuts,
      onSaveCurrent: () => {
        if (isStoryRoute(route)) downloadStoryMedia({ all: false });
        else downloadCurrentPostOrVisibleMedia();
      },
      onToggleSelect: () => {
        if (supportsGridMultiSelect(route)) toggleSelectionMode();
      }
    });
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || message.type !== MSG.UNDO_LAST_BATCH) return false;
        const historyApi = window.IgBulkDownloadHistory;
        if (!historyApi || !historyApi.undoLastBatch) {
          sendResponse({ ok: false, removed: 0, reason: "Undo is unavailable on this page." });
          return false;
        }
        historyApi.undoLastBatch().then(sendResponse);
        return true;
      });
    }
    mountUiForRoute();
    observePageChanges();
  }

  init();
})();
