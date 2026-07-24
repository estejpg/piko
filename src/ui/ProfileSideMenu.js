(function () {
  function createProfileSideMenu(actions) {
    const root = document.createElement("section");
    root.id = "ig-bulk-profile-menu";
    root.className = "ig-bulk-profile-menu ig-bulk-bottom-menu ig-bulk-page-menu";
    root.innerHTML = [
      '<div class="ig-bulk-bottom-menu__rail" role="toolbar" aria-label="Piko profile actions">',
      dockButton("visible", "Download visible media", "visible", "Visible"),
      dockButton("profile", "Download profile media", "grid", "Profile"),
      dockButton("reels", "Download reels", "reel", "Reels"),
      dockButton("thumbnail", "Toggle thumbnail mode", "thumbnail", "Thumbs"),
      dockButton("select", "Select profile media", "select", "Select"),
      dockButton("folder", "Change folder", "folder", "Folder"),
      '</div>',
      '<div class="ig-bulk-bottom-menu__status" data-role="status" aria-live="polite">Ready</div>'
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
          const selectionActive = action === "select" && root.classList.contains("is-selection-mode");
          button.classList.toggle("is-active", active || selectionActive);
          button.setAttribute("aria-pressed", active || thumbnailActive || selectionActive ? "true" : "false");
          if (active) {
            button.title = `Cancel ${button.dataset.label || action}`;
            button.setAttribute("aria-label", `Cancel ${button.dataset.label || action}`);
          } else if (!thumbnailActive && !selectionActive) {
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
      setSelectionMode(enabled) {
        root.classList.toggle("is-selection-mode", Boolean(enabled));
        const button = root.querySelector('button[data-action="select"]');
        if (button) {
          button.classList.toggle("is-active", Boolean(enabled));
          button.setAttribute("aria-pressed", enabled ? "true" : "false");
          button.title = enabled ? "Exit Select mode" : button.dataset.defaultTitle || "";
          button.setAttribute("aria-label", enabled ? "Exit Select mode" : button.dataset.defaultTitle || "");
        }
        root.classList.toggle("is-suppressed", Boolean(enabled));
      },
      setStatus(message) {
        const status = root.querySelector('[data-role="status"]');
        if (status) {
          status.textContent = message || "Ready";
          status.classList.toggle("has-message", Boolean(message && message !== "Ready"));
        }
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
