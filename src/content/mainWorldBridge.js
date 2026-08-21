(function () {
  // Slim MAIN-world helper. It no longer serves media data over an RPC bridge.
  // Its only jobs are:
  //   1. Stash the Instagram web API headers (app id + www claim) in sessionStorage,
  //      which is shared with the isolated content script. All media resolution now
  //      happens in the content script against Instagram's public web REST API.
  //   2. Emit SPA route-change events by patching the History API.
  //   3. Tag rendered media elements with their numeric media id (read from React
  //      fiber props) so feed/reels items without permalink anchors stay downloadable.
  const BRIDGE_SOURCE = "ig-bulk-bridge";
  const ROUTE_CHANGE = "IG_BULK_ROUTE_CHANGE";
  const APP_ID_KEY = "__piko_ig_app_id";
  const CLAIM_KEY = "__piko_ig_www_claim";
  const MEDIA_ID_ATTR = "data-ig-bulk-media-id";

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

  function stashApiHeaders() {
    let stashedAppId = false;
    let stashedClaim = false;

    try {
      const config = getRequireModule("PolarisConfig");
      const appId = config && typeof config.getIGAppID === "function" ? config.getIGAppID() : "";
      if (appId) {
        sessionStorage.setItem(APP_ID_KEY, String(appId));
        stashedAppId = true;
      }
    } catch (error) {
      stashedAppId = false;
    }

    try {
      const claimModule = getRequireModule("PolarisWWWClaim");
      const claim = claimModule && typeof claimModule.getWWWClaim === "function" ? claimModule.getWWWClaim() : "";
      if (claim) {
        sessionStorage.setItem(CLAIM_KEY, String(claim));
        stashedClaim = true;
      }
    } catch (error) {
      stashedClaim = false;
    }

    return stashedAppId && stashedClaim;
  }

  function stashApiHeadersWithRetry(attempt) {
    if (stashApiHeaders()) return;
    const nextAttempt = (attempt || 0) + 1;
    if (nextAttempt > 20) return;
    setTimeout(() => stashApiHeadersWithRetry(nextAttempt), Math.min(250 * nextAttempt, 2000));
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
      if (id) node.setAttribute(MEDIA_ID_ATTR, id);
    });
  }

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
        if (
          node.matches &&
          (node.matches("article, a[href*='/p/'], a[href*='/reel/'], img, video") ||
            node.querySelector("article, a[href*='/p/'], a[href*='/reel/'], img, video"))
        ) {
          scheduleMarkVisibleMediaIds(node);
        }
      }
    }
  });

  function start() {
    if (!document.body) {
      setTimeout(start, 50);
      return;
    }
    observer.observe(document.body, { childList: true, subtree: true });
    markVisibleMediaIds(document);
    emitRouteChange();
  }

  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");
  window.addEventListener("popstate", emitRouteChange);
  window.addEventListener("locationchange", emitRouteChange);

  stashApiHeadersWithRetry(0);
  // Instagram rotates the www claim after auth events; refresh the stash when its
  // own storage changes so long-lived tabs keep sending a valid claim header.
  window.addEventListener("storage", (event) => {
    if (event.key && !String(event.key).startsWith("__piko")) stashApiHeaders();
  });

  start();
})();
