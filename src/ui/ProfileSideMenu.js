(function () {
  function createProfileSideMenu(actions) {
    const dockButton = window.IgBulkIcons.dockButton;
    const root = document.createElement("section");
    root.id = "ig-bulk-profile-menu";
    root.className = "ig-bulk-profile-menu ig-bulk-bottom-menu ig-bulk-page-menu";
    root.innerHTML = [
      '<div class="ig-bulk-bottom-menu__rail" role="toolbar" aria-label="Piko profile actions">',
      dockButton("visible", "Download visible media", "visible", "Visible", { pressed: false }),
      dockButton("profile", "Download all profile media", "grid", "Profile", { pressed: false }),
      dockButton("select", "Select profile media", "select", "Select", { pressed: false }),
      dockButton("folder", "Change folder", "folder", "Folder", { pressed: false }),
      "</div>",
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
          const selectionActive = action === "select" && root.classList.contains("is-selection-mode");
          button.classList.toggle("is-active", active || selectionActive);
          button.setAttribute("aria-pressed", active || selectionActive ? "true" : "false");
          if (active) {
            button.title = `Cancel ${button.dataset.label || action}`;
            button.setAttribute("aria-label", `Cancel ${button.dataset.label || action}`);
          } else if (!selectionActive) {
            button.title = button.dataset.defaultTitle || "";
            button.setAttribute("aria-label", button.dataset.defaultTitle || "");
          }
        });
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

  window.IgBulkProfileSideMenu = { createProfileSideMenu };
})();
