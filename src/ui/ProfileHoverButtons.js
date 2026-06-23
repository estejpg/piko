(function () {
  function createButton(anchor, onDownloadTile) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ig-bulk-tile-download";
    button.title = "Download this media";
    button.setAttribute("aria-label", "Download this Instagram media");
    button.innerHTML = `${window.IgBulkIcons.icon("download")}<span>Save</span>`;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const shortcode = window.IgBulkMediaResolver.shortcodeFromUrl(anchor.href);
      onDownloadTile(anchor, shortcode, button);
    });

    return button;
  }

  function createProfileHoverButtons(options) {
    const anchors = new Set();

    function shouldDecorate(anchor) {
      if (!anchor || anchor.querySelector(".ig-bulk-tile-download")) return false;
      if (anchor.closest('[role="dialog"], [aria-modal="true"]')) return false;
      if (!window.IgBulkMediaResolver.shortcodeFromUrl(anchor.href)) return false;
      return Boolean(anchor.querySelector("img, video"));
    }

    function injectAnchor(anchor) {
      if (!shouldDecorate(anchor)) return;
      anchor.classList.add("ig-bulk-tile");
      anchor.appendChild(createButton(anchor, options.onDownloadTile));
      anchors.add(anchor);
    }

    function refresh() {
      anchors.forEach((anchor) => {
        if (!anchor.isConnected) anchors.delete(anchor);
      });
      document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"], main a[href*="/tv/"]').forEach(injectAnchor);
    }

    function destroy() {
      anchors.forEach((anchor) => {
        anchor.querySelectorAll(".ig-bulk-tile-download").forEach((button) => button.remove());
        anchor.classList.remove("ig-bulk-tile");
      });
      anchors.clear();
    }

    return { refresh, destroy };
  }

  window.IgBulkProfileHoverButtons = { createProfileHoverButtons };
})();
