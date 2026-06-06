(function () {
  function createProfileSideMenu(actions) {
    const root = document.createElement("section");
    root.id = "ig-bulk-profile-menu";
    root.className = "ig-bulk-profile-menu ig-bulk-profile-dock";
    root.innerHTML = [
      '<div class="ig-bulk-profile-dock__rail" aria-label="Instagram downloader profile actions">',
      dockButton("visible", "Download visible media", "visible", "Visible"),
      dockButton("profile", "Download profile media", "grid", "Profile"),
      dockButton("reels", "Download reels", "reel", "Reels"),
      dockButton("thumbnail", "Toggle thumbnail mode", "thumbnail", "Thumbs"),
      dockButton("folder", "Change folder", "folder", "Folder"),
      '</div>',
      '<div class="ig-bulk-profile-dock__status" data-role="status">Ready</div>'
    ].join("");

    let activeMode = null;

    root.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.getAttribute("data-action");
      if (activeMode === action && actions.cancel) {
        actions.cancel(action);
        return;
      }
      if (actions[action]) actions[action]();
    });

    return {
      element: root,
      setActiveMode(mode) {
        activeMode = mode || null;
        root.querySelectorAll("button[data-action]").forEach((button) => {
          const action = button.getAttribute("data-action");
          const active = Boolean(activeMode && action === activeMode);
          const thumbnailActive = button.classList.contains("is-thumbnail-active");
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-pressed", active || thumbnailActive ? "true" : "false");
          if (active) {
            button.title = `Cancel ${button.dataset.label || action}`;
            button.setAttribute("aria-label", `Cancel ${button.dataset.label || action}`);
          } else if (!thumbnailActive) {
            button.title = button.dataset.defaultTitle || "";
            button.setAttribute("aria-label", button.dataset.defaultTitle || "");
          }
        });
      },
      setThumbnailMode(enabled) {
        const button = root.querySelector('button[data-action="thumbnail"]');
        if (!button) return;
        button.classList.toggle("is-thumbnail-active", Boolean(enabled));
        button.setAttribute("aria-pressed", enabled ? "true" : "false");
        button.title = enabled ? "Disable thumbnail mode" : button.dataset.defaultTitle || "";
        button.setAttribute("aria-label", enabled ? "Disable thumbnail mode" : button.dataset.defaultTitle || "");
      },
      setStatus(message) {
        const status = root.querySelector('[data-role="status"]');
        if (status) status.textContent = message;
      }
    };
  }

  function dockButton(action, ariaLabel, iconName, label) {
    return [
      `<button type="button" class="ig-bulk-icon-button" data-action="${action}" data-label="${label}" data-default-title="${ariaLabel}" aria-label="${ariaLabel}" aria-pressed="false" title="${ariaLabel}">`,
      window.IgBulkIcons.icon(iconName),
      `<span>${label}</span>`,
      "</button>"
    ].join("");
  }

  window.IgBulkProfileSideMenu = { createProfileSideMenu };
})();
