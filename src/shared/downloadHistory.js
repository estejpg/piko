(function () {
  const HISTORY_KEY = "downloadHistory";
  const LAST_BATCH_KEY = "lastDownloadBatch";
  const MAX_ENTRIES = 40;

  function storageGet(keys) {
    return new Promise((resolve) => {
      if (!globalThis.chrome || !chrome.storage || !chrome.storage.local) {
        resolve({});
        return;
      }
      chrome.storage.local.get(keys, resolve);
    });
  }

  function storageSet(value) {
    return new Promise((resolve) => {
      if (!globalThis.chrome || !chrome.storage || !chrome.storage.local) {
        resolve();
        return;
      }
      chrome.storage.local.set(value, resolve);
    });
  }

  function normalizeEntry(entry) {
    return {
      id: String((entry && entry.id) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      filename: String((entry && entry.filename) || "file"),
      directoryName: String((entry && entry.directoryName) || ""),
      source: String((entry && entry.source) || "piko"),
      mediaType: String((entry && entry.mediaType) || "media"),
      savedAt: Number((entry && entry.savedAt) || Date.now()),
      canUndo: Boolean(entry && entry.canUndo && entry.directoryName)
    };
  }

  async function list() {
    const data = await storageGet([HISTORY_KEY]);
    const entries = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
    return entries.map(normalizeEntry);
  }

  async function getLastBatch() {
    const data = await storageGet([LAST_BATCH_KEY]);
    const batch = data[LAST_BATCH_KEY];
    if (!batch || !Array.isArray(batch.entries) || !batch.entries.length) return null;
    return {
      id: String(batch.id || ""),
      savedAt: Number(batch.savedAt || Date.now()),
      directoryName: String(batch.directoryName || ""),
      entries: batch.entries.map(normalizeEntry)
    };
  }

  async function record(entries, meta) {
    const normalized = (Array.isArray(entries) ? entries : [entries])
      .filter(Boolean)
      .map((entry) =>
        normalizeEntry({
          ...entry,
          savedAt: (meta && meta.savedAt) || Date.now(),
          directoryName: entry.directoryName || (meta && meta.directoryName) || "",
          source: entry.source || (meta && meta.source) || "piko",
          canUndo: Boolean((entry.directoryName || (meta && meta.directoryName)) && entry.filename)
        })
      );
    if (!normalized.length) return null;

    const existing = await list();
    const nextHistory = [...normalized, ...existing].slice(0, MAX_ENTRIES);
    const batch = {
      id: `batch-${Date.now()}`,
      savedAt: normalized[0].savedAt,
      directoryName: (meta && meta.directoryName) || normalized[0].directoryName || "",
      entries: normalized
    };
    await storageSet({
      [HISTORY_KEY]: nextHistory,
      [LAST_BATCH_KEY]: batch
    });
    return batch;
  }

  async function clear() {
    await storageSet({
      [HISTORY_KEY]: [],
      [LAST_BATCH_KEY]: null
    });
  }

  async function undoLastBatch() {
    const batch = await getLastBatch();
    if (!batch) {
      return { ok: false, removed: 0, reason: "No recent download batch to undo." };
    }

    const undoable = batch.entries.filter((entry) => entry.canUndo && entry.filename);
    if (!undoable.length) {
      return {
        ok: false,
        removed: 0,
        reason: "The last batch was saved with the browser download UI and cannot be undone from Piko."
      };
    }

    const downloader = window.IgBulkDownloader;
    if (!downloader || !downloader.getStoredDirectoryHandle) {
      return { ok: false, removed: 0, reason: "Folder access is unavailable in this context." };
    }

    let directory = null;
    try {
      directory = await downloader.getStoredDirectoryHandle();
      if (directory && directory.queryPermission) {
        const permission = await directory.queryPermission({ mode: "readwrite" });
        if (permission !== "granted" && directory.requestPermission) {
          const next = await directory.requestPermission({ mode: "readwrite" });
          if (next !== "granted") directory = null;
        }
      }
    } catch (error) {
      directory = null;
    }

    if (!directory || !directory.removeEntry) {
      return {
        ok: false,
        removed: 0,
        reason: "Could not access the saved folder to remove the last batch."
      };
    }

    let removed = 0;
    const failures = [];
    for (const entry of undoable) {
      try {
        await directory.removeEntry(entry.filename);
        removed += 1;
      } catch (error) {
        failures.push(entry.filename);
      }
    }

    const history = await list();
    const undoIds = new Set(batch.entries.map((entry) => entry.id));
    await storageSet({
      [HISTORY_KEY]: history.filter((entry) => !undoIds.has(entry.id)),
      [LAST_BATCH_KEY]: null
    });

    if (!removed) {
      return {
        ok: false,
        removed: 0,
        reason: failures.length
          ? "Could not delete the last batch files from the folder."
          : "Nothing was removed."
      };
    }

    return {
      ok: true,
      removed,
      failed: failures.length,
      directoryName: batch.directoryName || directory.name || ""
    };
  }

  window.IgBulkDownloadHistory = {
    clear,
    getLastBatch,
    list,
    record,
    undoLastBatch
  };
})();
