(function () {
  const DB_NAME = "ig-bulk-downloader";
  const STORE_NAME = "handles";
  const HANDLE_KEY = "bulkDirectory";

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getStoredDirectoryHandle() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function setStoredDirectoryHandle(handle) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function rememberSelectedFolderName(folderName) {
    if (!folderName || !globalThis.chrome || !chrome.storage || !chrome.storage.local) return;

    chrome.storage.local.get(["settings"], (data) => {
      const settings = {
        ...window.IG_BULK_DEFAULT_SETTINGS,
        ...(data.settings || {}),
        selectedFolderName: folderName
      };
      chrome.storage.local.set({ settings });
    });
  }

  async function fetchBlob(url, onProgress, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);

    const total = Number(response.headers.get("content-length")) || 0;
    if (!response.body) return response.blob();

    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;

    while (true) {
      const result = await reader.read();
      if (result.done) break;
      chunks.push(result.value);
      loaded += result.value.byteLength;
      if (onProgress) onProgress({ loaded, total });
    }

    return new Blob(chunks);
  }

  function saveBlobWithAnchor(blob, filename) {
    const anchor = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 250);
  }

  async function getPermittedStoredDirectory() {
    let handle = null;
    try {
      handle = await getStoredDirectoryHandle();
      if (!handle) return null;

      if (handle.queryPermission) {
        const currentPermission = await handle.queryPermission({ mode: "readwrite" });
        if (currentPermission === "granted") return handle;
      }

      if (handle.requestPermission) {
        const permission = await handle.requestPermission({ mode: "readwrite" });
        return permission === "granted" ? handle : null;
      }

      return handle;
    } catch (error) {
      return null;
    }
  }

  async function saveBlobToDirectory(blob, filename, directory) {
    const fileHandle = await directory.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { directoryName: directory.name, filename };
  }

  function recordHistory(entries, meta) {
    if (!window.IgBulkDownloadHistory || !window.IgBulkDownloadHistory.record) return;
    try {
      window.IgBulkDownloadHistory.record(entries, meta);
    } catch (error) {
      // History is best-effort and must never break downloads.
    }
  }

  async function downloadSingle(item, onProgress, options) {
    const directory = await getPermittedStoredDirectory();
    const blob = await fetchBlob(item.url, onProgress, options && options.signal);
    return saveBlobItem(item, blob, directory, options);
  }

  async function saveBlobItem(item, blob, directory, options) {
    directory = directory || (await getPermittedStoredDirectory());
    let result = null;
    if (directory) {
      try {
        result = await saveBlobToDirectory(blob, item.filename, directory);
      } catch (error) {
        // Fall back to Chrome's normal download flow if the saved handle is stale.
      }
    }

    if (!result) {
      saveBlobWithAnchor(blob, item.filename);
      result = { directoryName: "", filename: item.filename };
    }

    if (!(options && options.skipHistory)) {
      recordHistory(
        {
          filename: result.filename,
          directoryName: result.directoryName,
          mediaType: item && item.mediaType,
          source: (options && options.source) || (item && item.source) || "piko",
          canUndo: Boolean(result.directoryName)
        },
        { directoryName: result.directoryName, source: (options && options.source) || "piko" }
      );
    }

    return result;
  }

  async function chooseBulkDirectory() {
    if (!window.showDirectoryPicker) {
      throw new Error("Folder selection is not supported in this browser.");
    }

    const handle = await window.showDirectoryPicker({
      id: "ig-bulk-downloader",
      mode: "readwrite",
      startIn: "downloads"
    });
    await setStoredDirectoryHandle(handle);
    rememberSelectedFolderName(handle.name);
    return handle;
  }

  async function getBulkDirectory() {
    if (!window.showDirectoryPicker) {
      throw new Error("Folder selection is not supported in this browser.");
    }

    let handle = null;
    try {
      handle = await getStoredDirectoryHandle();
      if (handle && handle.requestPermission) {
        const permission = await handle.requestPermission({ mode: "readwrite" });
        if (permission !== "granted") handle = null;
      }
    } catch (error) {
      handle = null;
    }

    if (!handle) {
      handle = await chooseBulkDirectory();
    }

    return handle;
  }

  async function downloadBulk(items, callbacks) {
    const directory = await getBulkDirectory();
    let downloaded = 0;
    let skipped = 0;
    let failed = 0;
    const savedEntries = [];

    for (let index = 0; index < items.length; index += 1) {
      if (callbacks && callbacks.isCancelled && callbacks.isCancelled()) break;
      const item = items[index];
      try {
        callbacks && callbacks.onItemStart && callbacks.onItemStart({ item, index, total: items.length });
        const fileHandle = await directory.getFileHandle(item.filename, { create: true });
        const existingFile = await fileHandle.getFile();
        if (existingFile.size > 0) {
          skipped += 1;
        } else {
          const blob = await fetchBlob(
            item.url,
            (progress) => {
              callbacks && callbacks.onItemProgress && callbacks.onItemProgress({ item, index, total: items.length, ...progress });
            },
            callbacks && callbacks.signal
          );
          if (callbacks && callbacks.isCancelled && callbacks.isCancelled()) break;
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          downloaded += 1;
          savedEntries.push({
            filename: item.filename,
            directoryName: directory.name,
            mediaType: item.mediaType,
            source: (callbacks && callbacks.source) || "instagram",
            canUndo: true
          });
        }
      } catch (error) {
        failed += 1;
        callbacks && callbacks.onItemError && callbacks.onItemError({ item, index, error });
      }
      callbacks && callbacks.onBatchProgress && callbacks.onBatchProgress({ downloaded, skipped, failed, completed: index + 1, total: items.length });
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    if (savedEntries.length) {
      recordHistory(savedEntries, {
        directoryName: directory.name,
        source: (callbacks && callbacks.source) || "instagram"
      });
    }

    return { downloaded, skipped, failed, total: items.length, directoryName: directory.name };
  }

  window.IgBulkDownloader = {
    chooseBulkDirectory,
    downloadBulk,
    downloadSingle,
    fetchBlob,
    getBulkDirectory,
    getStoredDirectoryHandle,
    saveBlobItem
  };
})();

