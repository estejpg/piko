(function () {
  window.IG_BULK_MESSAGES = {
    CONTENT_SOURCE: "ig-bulk-content",
    BRIDGE_SOURCE: "ig-bulk-bridge",
    REQUEST_MEDIA: "IG_BULK_REQUEST_MEDIA",
    RESPONSE_MEDIA: "IG_BULK_RESPONSE_MEDIA",
    ROUTE_CHANGE: "IG_BULK_ROUTE_CHANGE",
    SETTINGS_CHANGED: "IG_BULK_SETTINGS_CHANGED"
  };

  window.IG_BULK_DEFAULT_SETTINGS = {
    filenamePattern: "{username}_{takenAt}_{id}",
    showFeedButton: true,
    lastUiMode: "idle",
    selectedFolderName: ""
  };
})();
