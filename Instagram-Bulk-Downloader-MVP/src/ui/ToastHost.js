(function () {
  let nextToastId = 1;

  function normalizeToast(input) {
    if (typeof input === "string") {
      return { title: input, tone: "neutral" };
    }
    return { ...(input || {}) };
  }

  function createToastElement(toast) {
    const element = document.createElement("div");
    element.className = `ig-bulk-toast ig-bulk-toast--${toast.tone || "neutral"}`;
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
    element.innerHTML = [
      '<div class="ig-bulk-toast__icon"></div>',
      '<div class="ig-bulk-toast__body">',
      '  <div class="ig-bulk-toast__title"></div>',
      '  <div class="ig-bulk-toast__detail"></div>',
      '  <div class="ig-bulk-toast__progress" hidden><span></span></div>',
      '</div>'
    ].join("");
    renderToast(element, toast);
    requestAnimationFrame(() => element.classList.add("is-visible"));
    return element;
  }

  function renderToast(element, toast) {
    const tone = toast.tone || "neutral";
    const visibleClass = element.classList.contains("is-visible") ? " is-visible" : "";
    element.className = `ig-bulk-toast ig-bulk-toast--${tone}${visibleClass}`;

    const iconName = tone === "success" ? "check" : tone === "error" || tone === "warning" ? "clear" : tone === "progress" ? "spinner" : "download";
    const icon = element.querySelector(".ig-bulk-toast__icon");
    const title = element.querySelector(".ig-bulk-toast__title");
    const detail = element.querySelector(".ig-bulk-toast__detail");
    const progress = element.querySelector(".ig-bulk-toast__progress");
    const progressBar = progress && progress.querySelector("span");

    if (icon) icon.innerHTML = window.IgBulkIcons.icon(iconName, tone === "progress" ? "is-spinning" : "");
    if (title) title.textContent = toast.title || "";
    if (detail) {
      detail.textContent = toast.detail || "";
      detail.hidden = !toast.detail;
    }

    const progressValue = typeof toast.progress === "number" ? Math.max(0, Math.min(100, toast.progress)) : null;
    if (progress && progressBar) {
      progress.hidden = progressValue === null;
      if (progressValue !== null) progressBar.style.transform = `scaleX(${progressValue / 100})`;
    }
  }

  function createToastHost() {
    const root = document.createElement("div");
    root.className = "ig-bulk-toast-host";
    document.body.appendChild(root);

    const toasts = new Map();

    function scheduleDismiss(id, timeoutMs) {
      if (timeoutMs === 0) return;
      const toast = toasts.get(id);
      if (!toast) return;
      clearTimeout(toast.timer);
      toast.timer = setTimeout(() => dismiss(id), timeoutMs || 4200);
    }

    function show(input) {
      const toast = { tone: "neutral", ...normalizeToast(input) };
      const id = toast.id || `toast-${nextToastId++}`;
      if (toasts.has(id)) {
        update(id, toast);
        return id;
      }

      const element = createToastElement(toast);
      root.appendChild(element);
      toasts.set(id, { element, data: toast, timer: null });
      scheduleDismiss(id, toast.timeoutMs);
      return id;
    }

    function update(id, input) {
      const existing = toasts.get(id);
      if (!existing) return show({ id, ...normalizeToast(input) });
      existing.data = { ...existing.data, ...normalizeToast(input) };
      renderToast(existing.element, existing.data);
      scheduleDismiss(id, existing.data.timeoutMs);
      return id;
    }

    function dismiss(id) {
      const existing = toasts.get(id);
      if (!existing) return;
      clearTimeout(existing.timer);
      existing.element.classList.remove("is-visible");
      existing.element.classList.add("is-leaving");
      setTimeout(() => existing.element.remove(), 180);
      toasts.delete(id);
    }

    return { dismiss, show, update };
  }

  window.IgBulkToastHost = { createToastHost };
})();
