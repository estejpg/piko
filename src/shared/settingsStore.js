(function () {
  function defaults() {
    return {
      ...(window.IG_BULK_DEFAULT_SETTINGS || {
        filenamePattern: "{username}_{takenAt}_{id}",
        showFeedButton: true,
        lastUiMode: "idle",
        selectedFolderName: ""
      })
    };
  }

  function normalize(nextSettings) {
    return {
      ...defaults(),
      ...(nextSettings || {})
    };
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
