(function () {
  const filenamePreset = document.getElementById("filenamePreset");
  const filenamePattern = document.getElementById("filenamePattern");
  const showReliabilityToasts = document.getElementById("showReliabilityToasts");
  const enableKeyboardShortcuts = document.getElementById("enableKeyboardShortcuts");
  const showFeedButton = document.getElementById("showFeedButton");
  const selectedFolder = document.getElementById("selectedFolder");
  const status = document.getElementById("status");
  const settingsStore = window.IgBulkSettingsStore;
  const presets = window.IG_BULK_FILENAME_PRESETS || [];
  let currentSettings = settingsStore.defaults();
  let applyingPreset = false;

  function setStatus(message) {
    status.textContent = message;
    setTimeout(() => {
      status.textContent = "Ready";
    }, 1800);
  }

  function populatePresets() {
    filenamePreset.replaceChildren();
    presets.forEach((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.label;
      filenamePreset.appendChild(option);
    });
  }

  function findPreset(id) {
    return presets.find((preset) => preset.id === id) || null;
  }

  function applyPresetToPattern(presetId, { forcePattern = false } = {}) {
    const preset = findPreset(presetId);
    const isCustom = !preset || preset.id === "custom";
    filenamePattern.disabled = !isCustom;
    if (!isCustom && forcePattern) {
      applyingPreset = true;
      filenamePattern.value = preset.pattern;
      applyingPreset = false;
    }
  }

  function save() {
    const presetId = filenamePreset.value || "custom";
    const preset = findPreset(presetId);
    const isCustom = !preset || preset.id === "custom";
    const patternValue = isCustom
      ? filenamePattern.value.trim() || settingsStore.defaults().filenamePattern
      : (preset.pattern || filenamePattern.value.trim() || settingsStore.defaults().filenamePattern);

    const settings = {
      ...currentSettings,
      filenamePreset: presetId,
      filenamePattern: patternValue,
      showReliabilityToasts: showReliabilityToasts.checked,
      enableKeyboardShortcuts: enableKeyboardShortcuts.checked,
      showFeedButton: showFeedButton.checked,
      selectedFolderName: selectedFolder.dataset.folderName || ""
    };

    settingsStore.patch(settings).then(() => {
      setStatus("Settings saved.");
    });
  }

  function renderSettings(nextSettings) {
    const settings = settingsStore.normalize(nextSettings);
    currentSettings = settings;
    const presetId = settings.filenamePreset || "custom";
    filenamePreset.value = findPreset(presetId) ? presetId : "custom";
    filenamePattern.value = settings.filenamePattern;
    applyPresetToPattern(filenamePreset.value, {
      forcePattern: filenamePreset.value !== "custom"
    });
    showReliabilityToasts.checked = settings.showReliabilityToasts !== false;
    enableKeyboardShortcuts.checked = Boolean(settings.enableKeyboardShortcuts);
    showFeedButton.checked = Boolean(settings.showFeedButton);
    renderSelectedFolder(settings.selectedFolderName);
  }

  function renderSelectedFolder(folderName) {
    selectedFolder.dataset.folderName = folderName || "";
    selectedFolder.textContent = folderName ? folderName : "Browser downloads";
  }

  populatePresets();
  settingsStore.load().then(renderSettings);
  settingsStore.subscribe(renderSettings);

  filenamePreset.addEventListener("change", () => {
    applyPresetToPattern(filenamePreset.value, { forcePattern: true });
    save();
  });
  filenamePattern.addEventListener("change", () => {
    if (applyingPreset || filenamePattern.disabled) return;
    filenamePreset.value = "custom";
    save();
  });
  showReliabilityToasts.addEventListener("change", save);
  enableKeyboardShortcuts.addEventListener("change", save);
  showFeedButton.addEventListener("change", save);
})();
