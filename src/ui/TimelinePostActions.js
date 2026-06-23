(function () {
  function visibleArea(element) {
    const rect = element.getBoundingClientRect();
    const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    return visibleWidth * visibleHeight;
  }

  function findPrimaryMedia(article) {
    const media = Array.from(article.querySelectorAll("img, video")).filter((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width < 140 || rect.height < 140) return false;
      if (node.tagName === "IMG" && String(node.alt || "").toLowerCase().includes("profile picture")) return false;
      return visibleArea(node) > 0;
    });
    return media.sort((a, b) => visibleArea(b) - visibleArea(a))[0] || null;
  }

  function findMediaContainer(article, media) {
    if (!article || !media) return null;
    const mediaRect = media.getBoundingClientRect();
    let best = media.parentElement;
    let cursor = media.parentElement;

    while (cursor && cursor !== article && cursor.parentElement) {
      const rect = cursor.getBoundingClientRect();
      const containsMedia = rect.width >= mediaRect.width * 0.92 && rect.height >= mediaRect.height * 0.92;
      const notTooLarge = rect.height <= Math.max(mediaRect.height * 1.45, mediaRect.height + 160);
      if (containsMedia && notTooLarge) best = cursor;
      cursor = cursor.parentElement;
    }

    return best || media.parentElement;
  }

  function isWithinSupportedSurface(element) {
    return Boolean(element && element.closest("main, [role='dialog'], [aria-modal='true']"));
  }

  function isReasonableMediaRoot(root, media) {
    if (!root || !media || root === document.body || root === document.documentElement) return false;
    if (!isWithinSupportedSurface(root)) return false;
    if (!root.contains(media)) return false;
    if (!root.querySelector("button, [role='button']")) return false;

    const rect = root.getBoundingClientRect();
    const mediaRect = media.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (rect.width < 180 || rect.height < 180) return false;
    if (rect.width > Math.min(viewportWidth || rect.width, Math.max(mediaRect.width + 360, 420))) return false;
    if (rect.height > Math.max((viewportHeight || rect.height) * 1.35, mediaRect.height + 280)) return false;

    return true;
  }

  function findMediaRoot(seed) {
    if (!seed || !isWithinSupportedSurface(seed)) return null;
    if (seed.matches && seed.matches("a[href*='/p/'], a[href*='/reel/'], a[href*='/tv/']") && seed.querySelector("img, video")) return null;
    const article = seed.closest && seed.closest("article");
    if (article && isWithinSupportedSurface(article)) return article;

    const media = seed.matches && seed.matches("img, video") ? seed : seed.querySelector && seed.querySelector("video, img");
    if (!media) return null;
    if (media.closest("a[href*='/p/'], a[href*='/reel/'], a[href*='/tv/']")) return null;

    let cursor = seed.matches && seed.matches("a[href*='/reel/']") ? seed : media.parentElement;
    while (cursor && cursor !== document.body && cursor !== document.documentElement) {
      if (cursor.matches && cursor.matches("main, [role='dialog'], [aria-modal='true']")) break;
      if (isReasonableMediaRoot(cursor, media)) return cursor;
      cursor = cursor.parentElement;
    }

    return null;
  }

  function collectTimelineRoots() {
    const roots = new Set();
    document.querySelectorAll("main article, [role='dialog'] article, [aria-modal='true'] article").forEach((article) => roots.add(article));
    document.querySelectorAll("main video, main a[href*='/reel/'], [role='dialog'] video, [role='dialog'] a[href*='/reel/'], [aria-modal='true'] video, [aria-modal='true'] a[href*='/reel/']").forEach((node) => {
      const root = findMediaRoot(node);
      if (root) roots.add(root);
    });
    return Array.from(roots);
  }

  function findActionContainer(article, media) {
    if (!article) return null;
    const mediaRect = media ? media.getBoundingClientRect() : null;
    const candidates = Array.from(article.querySelectorAll("section, footer, [role='group']")).filter((node) => {
      if (!node || node.querySelector(".ig-bulk-timeline-download")) return false;
      if (media && node.contains(media)) return false;
      if (!node.querySelector("button, [role='button'], a[href], svg")) return false;
      const rect = node.getBoundingClientRect();
      const compactRow = rect.width >= 120 && rect.height >= 18 && rect.height <= 120;
      const compactRail = mediaRect && rect.width >= 36 && rect.width <= 180 && rect.height >= 80 && rect.height <= Math.max(mediaRect.height + 120, 240);
      if (!compactRow && !compactRail) return false;
      return true;
    });

    if (!candidates.length) return null;

    return candidates
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const afterMedia = mediaRect ? rect.top >= mediaRect.bottom - 12 : false;
        const distance = mediaRect ? Math.abs(rect.top - mediaRect.bottom) : rect.top;
        const buttonCount = node.querySelectorAll("button, [role='button']").length;
        return { afterMedia, buttonCount, distance, node, top: rect.top };
      })
      .sort((a, b) => {
        if (a.afterMedia !== b.afterMedia) return a.afterMedia ? -1 : 1;
        if (a.buttonCount !== b.buttonCount) return b.buttonCount - a.buttonCount;
        if (a.distance !== b.distance) return a.distance - b.distance;
        return a.top - b.top;
      })[0].node;
  }

  function createButton(article, onDownloadArticle) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ig-bulk-tile-download ig-bulk-timeline-download";
    button.title = "Download this post";
    button.setAttribute("aria-label", "Download this Instagram post");
    button.innerHTML = `${window.IgBulkIcons.icon("download")}<span>Save</span>`;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled || button.getAttribute("aria-disabled") === "true") return;
      onDownloadArticle(article, button);
    });

    return button;
  }

  function directChildFor(container, node) {
    let cursor = node;
    while (cursor && cursor.parentElement && cursor.parentElement !== container) {
      cursor = cursor.parentElement;
    }
    return cursor && cursor.parentElement === container ? cursor : null;
  }

  function findTrailingActionReference(container) {
    const controls = Array.from(container.querySelectorAll("button, [role='button']")).filter((node) => {
      return !node.closest(".ig-bulk-timeline-download");
    });
    const children = controls
      .map((node) => directChildFor(container, node))
      .filter(Boolean)
      .filter((child, index, list) => list.indexOf(child) === index);

    return controls.length >= 4 && children.length >= 2 ? children[children.length - 1] : null;
  }

  function mountButton(container, button, actionContainer) {
    if (!actionContainer) {
      container.appendChild(button);
      return;
    }

    const reference = findTrailingActionReference(container);
    if (reference) container.insertBefore(button, reference);
    else container.appendChild(button);
  }

  function createTimelinePostActions(options) {
    const decorated = new Set();
    const buttons = new Set();

    function pruneDisconnected() {
      decorated.forEach((container) => {
        if (!container.isConnected) decorated.delete(container);
      });
      buttons.forEach((button) => {
        if (!button.isConnected) buttons.delete(button);
      });
    }

    function injectArticle(article) {
      if (!article) return;
      if (article.querySelector(".ig-bulk-timeline-download")) return;
      const media = findPrimaryMedia(article);
      const actionContainer = findActionContainer(article, media);
      const container = actionContainer || findMediaContainer(article, media);
      if (!container || decorated.has(container) || container.querySelector(".ig-bulk-timeline-download")) return;

      container.classList.add("ig-bulk-tile", actionContainer ? "ig-bulk-timeline-actions" : "ig-bulk-timeline-media");
      const button = createButton(article, options.onDownloadArticle);
      button.classList.toggle("ig-bulk-timeline-download--overlay", !actionContainer);
      mountButton(container, button, actionContainer);
      decorated.add(container);
      buttons.add(button);
    }

    function refresh() {
      pruneDisconnected();
      collectTimelineRoots().forEach(injectArticle);
    }

    function destroy() {
      buttons.forEach((button) => button.remove());
      buttons.clear();
      decorated.forEach((container) => {
        container.classList.remove("ig-bulk-timeline-actions", "ig-bulk-timeline-media");
        if (!container.querySelector(".ig-bulk-tile-download, .ig-bulk-tile-select")) container.classList.remove("ig-bulk-tile");
      });
      decorated.clear();
    }

    return { refresh, destroy };
  }

  window.IgBulkTimelinePostActions = { createTimelinePostActions };
})();
