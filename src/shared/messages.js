(function () {
  window.IG_BULK_MESSAGES = {
    BRIDGE_SOURCE: "ig-bulk-bridge",
    ROUTE_CHANGE: "IG_BULK_ROUTE_CHANGE",
    SETTINGS_CHANGED: "IG_BULK_SETTINGS_CHANGED",
    UNDO_LAST_BATCH: "IG_BULK_UNDO_LAST_BATCH"
  };

  window.IG_BULK_FILENAME_PRESETS = [
    { id: "default", label: "Username · time · id", pattern: "{username}_{takenAt}_{id}" },
    { id: "username-id", label: "Username · id", pattern: "{username}_{id}" },
    { id: "date-first", label: "Time · username · id", pattern: "{takenAt}_{username}_{id}" },
    { id: "typed", label: "Username · type · index", pattern: "{username}_{type}_{index}" },
    { id: "custom", label: "Custom pattern", pattern: "" }
  ];

  window.IG_BULK_DEFAULT_SETTINGS = {
    filenamePattern: "{username}_{takenAt}_{id}",
    filenamePreset: "default",
    showFeedButton: true,
    lastUiMode: "idle",
    selectedFolderName: "",
    showReliabilityToasts: true,
    enableKeyboardShortcuts: false
  };
})();
