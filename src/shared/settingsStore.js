(function () {
  function defaults() {
    return {
      ...(window.IG_BULK_DEFAULT_SETTINGS || {
        filenamePattern: "{username}_{takenAt}_{id}",
        filenamePreset: "default",
        showFeedButton: true,
        lastUiMode: "idle",
        selectedFolderName: "",
        showReliabilityToasts: true,
        enableKeyboardShortcuts: false
      })
    };
  }

  function normalize(nextSettings) {
    const merged = {
      ...defaults(),
      ...(nextSettings || {})
    };
    merged.showFeedButton = Boolean(merged.showFeedButton);
    merged.showReliabilityToasts = merged.showReliabilityToasts !== false;
    merged.enableKeyboardShortcuts = Boolean(merged.enableKeyboardShortcuts);
    merged.filenamePattern = String(merged.filenamePattern || defaults().filenamePattern).trim() || defaults().filenamePattern;
    merged.filenamePreset = String(merged.filenamePreset || "custom");
    merged.selectedFolderName = String(merged.selectedFolderName || "");
    merged.lastUiMode = String(merged.lastUiMode || "idle");
    return merged;
  }

  function storageGet(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  function storageSet(value) {
    return new Promise((resolve) => {
      chrome.storage.local.set(value, resolve);
    });
  }

  async function load() {
    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        const response = await chrome.runtime.sendMessage({ type: "IG_BULK_GET_SETTINGS" });
        return normalize(response && response.settings);
      }
    } catch (error) {
      // Fall through to direct storage read for pages where runtime messaging is unavailable.
    }

    const data = await storageGet(["settings"]);
    return normalize(data.settings);
  }

  async function patch(patchValue) {
    const data = await storageGet(["settings"]);
    const settings = normalize({
      ...(data.settings || {}),
      ...(patchValue || {})
    });
    await storageSet({ settings });
    return settings;
  }

  function subscribe(callback) {
    const listener = (changes, areaName) => {
      if (areaName !== "local" || !changes.settings) return;
      callback(normalize(changes.settings.newValue), normalize(changes.settings.oldValue));
    };
    chrome.storage.onChanged.addListener(listener);
    return function unsubscribe() {
      chrome.storage.onChanged.removeListener(listener);
    };
  }

  window.IgBulkSettingsStore = {
    defaults,
    load,
    normalize,
    patch,
    subscribe
  };
})();
