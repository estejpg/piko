(function () {
  const BRIDGE_SOURCE = "ig-bulk-bridge";
  const CONTENT_SOURCE = "ig-bulk-content";
  const REQUEST_MEDIA = "IG_BULK_REQUEST_MEDIA";
  const RESPONSE_MEDIA = "IG_BULK_RESPONSE_MEDIA";
  const ROUTE_CHANGE = "IG_BULK_ROUTE_CHANGE";

  function emitRouteChange() {
    window.postMessage(
      { source: BRIDGE_SOURCE, type: ROUTE_CHANGE, path: location.pathname, href: location.href },
      location.origin
    );
  }

  function patchHistoryMethod(methodName) {
    const original = history[methodName];
    if (typeof original !== "function" || original.__igBulkPatched) return;

    const patched = function () {
      const result = original.apply(this, arguments);
      window.dispatchEvent(new Event(methodName.toLowerCase()));
      window.dispatchEvent(new Event("locationchange"));
      emitRouteChange();
      return result;
    };

    patched.__igBulkPatched = true;
    history[methodName] = patched;
  }

  function getRequireModule(name) {
    try {
      if (typeof window.require === "function") return window.require(name);
    } catch (error) {
      return null;
    }
    return null;
  }

  async function loadPostFromShortcode(shortcode) {
    const relay = getRequireModule("CometRelay");
    const environment = getRequireModule("PolarisRelayEnvironment");
    const postQuery = getRequireModule("PolarisPostActionLoadPostQuery");

    if (relay && environment && postQuery && postQuery.POST_QUERY) {
      const result = await relay
        .fetchQuery(environment, postQuery.POST_QUERY, {
          child_comment_count: 3,
          fetch_comment_count: 10,
          has_threaded_comments: true,
          parent_comment_count: 10,
          shortcode
        })
        .toPromise();

      const media = result && result.xdt_shortcode_media;
      if (media && media.__fragments) {
        return (
          media.__fragments.PolarisPostActionLoadPostQueryInlineFragment ||
          media.__fragments.PolarisPostActionLoadPostQueryInlineFragmentWithoutRelatedProfiles ||
          media
        );
      }
      return media || null;
    }

    return null;
  }

  async function instapiGet(url, query) {
    const instapi = getRequireModule("PolarisInstapi");
    if (!instapi || typeof instapi.apiGet !== "function") {
      throw new Error("PolarisInstapi is unavailable on this page.");
    }
    const result = await instapi.apiGet(url, { query: query || {} });
    return result && Object.prototype.hasOwnProperty.call(result, "data") ? result.data : result;
  }

  function trayEntries(payload) {
    if (!payload) return [];
    if (Array.isArray(payload.tray)) return payload.tray;
    if (Array.isArray(payload.reels)) return payload.reels;
    if (payload.tray && typeof payload.tray === "object") return Object.values(payload.tray);
    return [];
  }

  function reelIdFromTrayEntry(entry) {
    if (!entry) return "";
    return String(entry.id || entry.reel_id || (entry.user && (entry.user.pk || entry.user.id)) || "");
  }

  function usernameFromTrayEntry(entry) {
    if (!entry) return "";
    return String((entry.user && entry.user.username) || entry.username || "").toLowerCase();
  }

  async function resolveStoryReelId(username, highlightId) {
    if (highlightId) return `highlight:${highlightId}`;
    const tray = await instapiGet("/api/v1/feed/reels_tray/", { is_following_feed: false });
    const wanted = String(username || "").toLowerCase();
    const match = trayEntries(tray).find((entry) => usernameFromTrayEntry(entry) === wanted);
    const reelId = reelIdFromTrayEntry(match);
    if (!reelId) throw new Error("Story reel was not found in the tray.");
    return reelId;
  }

  async function loadStoryReelMedia(options) {
    const username = options && options.username;
    const highlightId = options && options.highlightId;
    const mediaId = options && options.mediaId ? String(options.mediaId) : "";
    const all = Boolean(options && options.all);

    const reelId = await resolveStoryReelId(username, highlightId);
    const payload = await instapiGet("/api/v1/feed/reels_media/", {
      reel_ids: String(reelId),
      media_id: mediaId || undefined
    });

    const reelsMedia = Array.isArray(payload && payload.reels_media)
      ? payload.reels_media
      : payload && payload.reels && payload.reels[reelId]
        ? [payload.reels[reelId]]
        : [];
    const reel = reelsMedia[0] || (payload && payload.reels && payload.reels[reelId]) || null;
    const items = reel && Array.isArray(reel.items) ? reel.items : [];
    const user = (reel && reel.user) || (payload && payload.reels && payload.reels[reelId] && payload.reels[reelId].user) || null;
    const filtered = !all && mediaId ? items.filter((item) => String(item.pk || item.id) === mediaId) : items;

    return {
      reelId,
      user,
      items: filtered.length ? filtered : items,
      all
    };
  }

  function getReactMediaIdFromNode(node) {
    if (!node) return null;
    for (const key of Object.keys(node)) {
      if (!key.startsWith("__reactFiber$")) continue;
      let cursor = node[key];
      for (let depth = 0; cursor && depth < 24; depth += 1) {
        const props = cursor.memoizedProps || {};
        const id =
          props.id ||
          props.postId ||
          props.videoFBID ||
          (props.post && props.post.id) ||
          (props.media && props.media.pk);
        if (id && /^\d+$/.test(String(id))) return String(id);
        cursor = cursor.return;
      }
    }
    return null;
  }

  function markVisibleMediaIds(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const nodes = scope.querySelectorAll("article, a[href*='/p/'], a[href*='/reel/'], img, video");
    nodes.forEach((node) => {
      const id = getReactMediaIdFromNode(node) || getReactMediaIdFromNode(node.parentElement);
      if (id) node.setAttribute("data-ig-bulk-media-id", id);
    });
  }

  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");
  window.addEventListener("popstate", emitRouteChange);
  window.addEventListener("locationchange", emitRouteChange);

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data || {};
    if (message.source !== CONTENT_SOURCE || message.type !== REQUEST_MEDIA) return;

    let payload = null;
    let error = null;

    try {
      if (message.kind === "postByShortcode") {
        payload = await loadPostFromShortcode(message.shortcode);
      } else if (message.kind === "storyReelMedia") {
        payload = await loadStoryReelMedia(message);
      } else if (message.kind === "markMediaIds") {
        markVisibleMediaIds(document);
        payload = { ok: true };
      }
    } catch (err) {
      error = err && err.message ? err.message : String(err);
    }

    window.postMessage(
      {
        source: BRIDGE_SOURCE,
        type: RESPONSE_MEDIA,
        requestId: message.requestId,
        payload,
        error
      },
      location.origin
    );
  });

  const pendingMarkRoots = new Set();
  let markTimer = null;

  function scheduleMarkVisibleMediaIds(root) {
    if (root && root.querySelectorAll) pendingMarkRoots.add(root);
    if (markTimer) return;
    markTimer = setTimeout(() => {
      const roots = Array.from(pendingMarkRoots).slice(0, 12);
      pendingMarkRoots.clear();
      markTimer = null;
      roots.forEach((root) => markVisibleMediaIds(root));
    }, 350);
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.id && String(node.id).startsWith("ig-bulk")) continue;
        if (node.matches && (node.matches("article, a[href*='/p/'], a[href*='/reel/'], img, video") || node.querySelector("article, a[href*='/p/'], a[href*='/reel/'], img, video"))) {
          scheduleMarkVisibleMediaIds(node);
        }
      }
    }
  });

  function startObserver() {
    if (!document.body) {
      setTimeout(startObserver, 50);
      return;
    }
    observer.observe(document.body, { childList: true, subtree: true });
    markVisibleMediaIds(document);
    emitRouteChange();
  }

  startObserver();
})();
