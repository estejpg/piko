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
