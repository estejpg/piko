const DEFAULT_SETTINGS = {
  filenamePattern: "{username}_{takenAt}_{id}",
  filenamePreset: "default",
  showFeedButton: true,
  lastUiMode: "idle",
  selectedFolderName: "",
  showReliabilityToasts: true,
  enableKeyboardShortcuts: false
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["settings"], (data) => {
    if (!data.settings) {
      chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS } });
      return;
    }
    chrome.storage.local.set({
      settings: {
        ...DEFAULT_SETTINGS,
        ...data.settings
      }
    });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "IG_BULK_GET_SETTINGS") return false;

  chrome.storage.local.get(["settings"], (data) => {
    sendResponse({
      settings: {
        ...DEFAULT_SETTINGS,
        ...(data.settings || {})
      }
    });
  });

  return true;
});
