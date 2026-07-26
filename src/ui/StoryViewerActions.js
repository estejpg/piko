(function () {
  function createStoryViewerActions(actions) {
    const dockButton = window.IgBulkIcons.dockButton;
    const root = document.createElement("section");
    root.id = "ig-bulk-story-actions";
    root.className = "ig-bulk-story-actions ig-bulk-bottom-menu ig-bulk-page-menu";
    root.innerHTML = [
      '<div class="ig-bulk-bottom-menu__rail" role="toolbar" aria-label="Piko story actions">',
      dockButton("current", "Download current story item", "download", "Current", { persistDefaultTitle: false }),
      dockButton("all", "Download all items in this story", "reel", "All", { persistDefaultTitle: false }),
      dockButton("folder", "Change folder", "folder", "Folder", { persistDefaultTitle: false }),
      "</div>",
      '<div class="ig-bulk-bottom-menu__status" data-role="status" aria-live="polite">Ready</div>'
    ].join("");

    root.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.getAttribute("data-action");
      if (actions[action]) actions[action](button);
    });

    return {
      element: root,
      setBusy(busy) {
        root.classList.toggle("is-busy", Boolean(busy));
        root.querySelectorAll("button[data-action]").forEach((button) => {
          button.disabled = Boolean(busy);
          button.setAttribute("aria-disabled", busy ? "true" : "false");
        });
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

  window.IgBulkStoryViewerActions = { createStoryViewerActions };
})();
