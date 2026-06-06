chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["settings"], (data) => {
    if (!data.settings) {
      chrome.storage.local.set({
        settings: {
          filenamePattern: "{username}_{takenAt}_{id}",
          showFeedButton: true,
          lastUiMode: "idle",
          selectedFolderName: ""
        }
      });
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "IG_BULK_GET_SETTINGS") return false;

  chrome.storage.local.get(["settings"], (data) => {
    sendResponse({
      settings: {
        filenamePattern: "{username}_{takenAt}_{id}",
        showFeedButton: true,
        lastUiMode: "idle",
        selectedFolderName: "",
        ...(data.settings || {})
      }
    });
  });

  return true;
});
