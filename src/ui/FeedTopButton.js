(function () {
  function createFeedTopButton(actions) {
    const root = document.createElement("section");
    root.id = "ig-bulk-feed-button";
    root.className = "ig-bulk-feed ig-bulk-bottom-menu ig-bulk-page-menu";
    const buttons = [
      dockButton("current", "Download current post or reel", "download", "Current"),
      actions.select ? dockButton("select", "Select media", "select", "Select") : "",
      dockButton("folder", "Change folder", "folder", "Folder"),
      dockButton("options", "Open settings", "settings", "Settings")
    ].join("");
    root.innerHTML = [
      '<div class="ig-bulk-bottom-menu__rail" role="toolbar" aria-label="Piko page actions">',
      buttons,
      '</div>',
      '<div class="ig-bulk-bottom-menu__status" data-role="status" aria-live="polite">Ready</div>'
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
      setSelectionMode(enabled) {
        const button = root.querySelector('button[data-action="select"]');
        if (button) {
          button.classList.toggle("is-active", Boolean(enabled));
          button.setAttribute("aria-pressed", enabled ? "true" : "false");
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
      `<button type="button" class="ig-bulk-icon-button" data-action="${action}" data-label="${label}" aria-label="${ariaLabel}" title="${ariaLabel}">`,
      window.IgBulkIcons.icon(iconName),
      `<span>${label}</span>`,
      "</button>"
    ].join("");
  }

  window.IgBulkFeedTopButton = { createFeedTopButton };
})();
