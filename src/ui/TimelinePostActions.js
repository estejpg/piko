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

  function createButton(article, onDownloadArticle) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ig-bulk-tile-download ig-bulk-timeline-download";
    button.title = "Download this post";
    button.setAttribute("aria-label", "Download this Instagram post");
    button.innerHTML = window.IgBulkIcons.icon("download");

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled || button.getAttribute("aria-disabled") === "true") return;
      onDownloadArticle(article, button);
    });

    return button;
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
      const media = findPrimaryMedia(article);
      const container = findMediaContainer(article, media);
      if (!container || decorated.has(container) || container.querySelector(".ig-bulk-timeline-download")) return;

      container.classList.add("ig-bulk-tile", "ig-bulk-timeline-media");
      const button = createButton(article, options.onDownloadArticle);
      container.appendChild(button);
      decorated.add(container);
      buttons.add(button);
    }

    function refresh() {
      pruneDisconnected();
      document.querySelectorAll("main article, [role='dialog'] article, [aria-modal='true'] article").forEach(injectArticle);
    }

    function destroy() {
      buttons.forEach((button) => button.remove());
      buttons.clear();
      decorated.forEach((container) => {
        container.classList.remove("ig-bulk-timeline-media");
        if (!container.querySelector(".ig-bulk-tile-download, .ig-bulk-tile-select")) container.classList.remove("ig-bulk-tile");
      });
      decorated.clear();
    }

    return { refresh, destroy };
  }

  window.IgBulkTimelinePostActions = { createTimelinePostActions };
})();
