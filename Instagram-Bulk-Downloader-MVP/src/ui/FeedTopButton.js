(function () {
  function createFeedTopButton(actions) {
    const root = document.createElement("section");
    root.id = "ig-bulk-feed-button";
    root.className = "ig-bulk-feed ig-bulk-feed-dock";
    root.innerHTML = [
      '<div class="ig-bulk-feed-dock__rail" aria-label="Instagram downloader feed actions">',
      dockButton("current", "Download current post or reel", "download", "Current"),
      dockButton("folder", "Change folder", "folder", "Folder"),
      dockButton("options", "Open settings", "settings", "Settings"),
      '</div>',
      '<div class="ig-bulk-feed-dock__status" data-role="status">Ready</div>'
    ].join("");

    root.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.getAttribute("data-action");
      if (actions[action]) actions[action]();
    });

    return {
      element: root,
      setStatus(message) {
        const status = root.querySelector('[data-role="status"]');
        if (status) status.textContent = message;
      }
    };
  }

  function dockButton(action, ariaLabel, iconName, label) {
    return [
      `<button type="button" class="ig-bulk-icon-button" data-action="${action}" data-label="${label}" aria-label="${ariaLabel}" title="${ariaLabel}">`,
      window.IgBulkIcons.icon(iconName),
      `<span>${label}</span>`,
      "</button>"
    ].join("");
  }

  window.IgBulkFeedTopButton = { createFeedTopButton };
})();
