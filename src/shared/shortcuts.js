(function () {
  function isEditableTarget(target) {
    if (!target) return false;
    if (target.isContentEditable) return true;
    const tag = String(target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    return Boolean(target.closest && target.closest("[contenteditable='true'], input, textarea, select"));
  }

  function createShortcutController(options) {
    let enabled = Boolean(options && options.enabled);
    let bound = false;

    function onKeyDown(event) {
      if (!enabled || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isEditableTarget(event.target)) return;

      const key = String(event.key || "").toLowerCase();
      if (key === "s") {
        if (options && options.onSaveCurrent) {
          event.preventDefault();
          options.onSaveCurrent();
        }
        return;
      }
      if (key === "a") {
        if (options && options.onToggleSelect) {
          event.preventDefault();
          options.onToggleSelect();
        }
      }
    }

    function bind() {
      if (bound) return;
      window.addEventListener("keydown", onKeyDown, true);
      bound = true;
    }

    function unbind() {
      if (!bound) return;
      window.removeEventListener("keydown", onKeyDown, true);
      bound = false;
    }

    function setEnabled(nextEnabled) {
      enabled = Boolean(nextEnabled);
      if (enabled) bind();
      else unbind();
    }

    setEnabled(enabled);

    return {
      destroy: unbind,
      setEnabled
    };
  }

  window.IgBulkShortcuts = { createShortcutController, isEditableTarget };
})();
