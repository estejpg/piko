(function () {
  const showFeedButton = document.getElementById("showFeedButton");
  const filenamePattern = document.getElementById("filenamePattern");
  const selectedFolder = document.getElementById("selectedFolder");
  const status = document.getElementById("status");
  const settingsStore = window.IgBulkSettingsStore;
  let currentSettings = settingsStore.defaults();

  function setStatus(message) {
    status.textContent = message;
    setTimeout(() => {
      status.textContent = "Ready";
    }, 1800);
  }

  function save() {
    const settings = {
      ...currentSettings,
      showFeedButton: showFeedButton.checked,
      filenamePattern: filenamePattern.value.trim() || settingsStore.defaults().filenamePattern,
      selectedFolderName: selectedFolder.dataset.folderName || ""
    };

    settingsStore.patch(settings).then(() => {
      setStatus("Settings saved.");
    });
  }

  function renderSettings(nextSettings) {
    const settings = settingsStore.normalize(nextSettings);
    currentSettings = settings;
    showFeedButton.checked = Boolean(settings.showFeedButton);
    filenamePattern.value = settings.filenamePattern;
    renderSelectedFolder(settings.selectedFolderName);
  }

  settingsStore.load().then(renderSettings);

  settingsStore.subscribe(renderSettings);

  function renderSelectedFolder(folderName) {
    selectedFolder.dataset.folderName = folderName || "";
    selectedFolder.textContent = folderName ? folderName : "No folder selected yet.";
  }

  showFeedButton.addEventListener("change", save);
  filenamePattern.addEventListener("change", save);
})();
