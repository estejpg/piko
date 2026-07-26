(function () {
  const pageTitle = document.querySelector('[data-role="page-title"]');
  const pageDetail = document.querySelector('[data-role="page-detail"]');
  const statusDot = document.querySelector('[data-role="status-dot"]');
  const folder = document.querySelector('[data-role="folder"]');
  const historyList = document.querySelector('[data-role="history-list"]');
  const historyStatus = document.querySelector('[data-role="history-status"]');
  const historyApi = window.IgBulkDownloadHistory;

  function formatTime(savedAt) {
    try {
      return new Date(savedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
    } catch (error) {
      return "";
    }
  }

  function setHistoryStatus(message) {
    historyStatus.textContent = message || "";
  }

  async function renderHistory() {
    if (!historyApi || !historyList) return;
    const entries = await historyApi.list();
    const recent = entries.slice(0, 5);
    historyList.replaceChildren();

    if (!recent.length) {
      const empty = document.createElement("li");
      empty.className = "history__empty";
      empty.textContent = "No recent downloads";
      historyList.appendChild(empty);
      return;
    }

    recent.forEach((entry) => {
      const item = document.createElement("li");
      const name = document.createElement("span");
      name.className = "history__name";
      name.textContent = entry.filename;
      const time = document.createElement("span");
      time.className = "history__time";
      time.textContent = formatTime(entry.savedAt);
      item.append(name, time);
      historyList.appendChild(item);
    });
  }

  function renderPage(urlString) {
    let host = "";
    try {
      host = new URL(urlString || "").hostname.replace(/^www\./, "");
    } catch (error) {
      host = "";
    }

    const isInstagram = host === "instagram.com" || host.endsWith(".instagram.com");
    const isYouTube = host === "youtube.com" || host.endsWith(".youtube.com");
    const isSupported = isInstagram || isYouTube;

    statusDot.classList.toggle("is-ready", isSupported);
    if (isInstagram) {
      pageTitle.textContent = "Ready on Instagram";
      pageDetail.textContent = "Use Piko’s controls on posts, reels, profiles, and media grids.";
    } else if (isYouTube) {
      pageTitle.textContent = "Ready on YouTube";
      pageDetail.textContent = "Use Piko beside videos and directly on listing thumbnails.";
    } else {
      pageTitle.textContent = "No controls on this page";
      pageDetail.textContent = "Open Instagram or YouTube to use Piko’s on-page tools.";
    }
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    renderPage(tabs && tabs[0] && tabs[0].url);
  });

  window.IgBulkSettingsStore.load().then((settings) => {
    folder.textContent = settings.selectedFolderName || "Browser downloads";
  });

  renderHistory();

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "settings") {
      chrome.runtime.openOptionsPage();
      return;
    }
    if (action === "instagram") {
      chrome.tabs.create({ url: "https://www.instagram.com/" });
      return;
    }
    if (action === "youtube") {
      chrome.tabs.create({ url: "https://www.youtube.com/" });
      return;
    }
    if (action === "undo") {
      button.disabled = true;
      try {
        // Directory handles live in the host-page IndexedDB; ask the active tab to undo.
        const result = await new Promise((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            if (!tab || !tab.id) {
              resolve({ ok: false, reason: "Open an Instagram or YouTube tab to undo folder saves." });
              return;
            }
            chrome.tabs.sendMessage(
              tab.id,
              { type: (window.IG_BULK_MESSAGES && window.IG_BULK_MESSAGES.UNDO_LAST_BATCH) || "IG_BULK_UNDO_LAST_BATCH" },
              (response) => {
                if (chrome.runtime.lastError) {
                  resolve({
                    ok: false,
                    reason: "Open an Instagram or YouTube tab with Piko loaded to undo folder saves."
                  });
                  return;
                }
                resolve(response || { ok: false, reason: "Could not undo the last batch." });
              }
            );
          });
        });
        if (result && result.ok) {
          const failedNote = result.failed ? ` (${result.failed} failed)` : "";
          setHistoryStatus(`Removed ${result.removed} file${result.removed === 1 ? "" : "s"}${failedNote}.`);
        } else {
          setHistoryStatus((result && result.reason) || "Could not undo the last batch.");
        }
        await renderHistory();
      } catch (error) {
        setHistoryStatus("Could not undo the last batch.");
      } finally {
        button.disabled = false;
      }
      return;
    }
    if (action === "clear-history") {
      if (!historyApi || !historyApi.clear) return;
      button.disabled = true;
      try {
        await historyApi.clear();
        setHistoryStatus("History cleared.");
        await renderHistory();
      } catch (error) {
        setHistoryStatus("Could not clear history.");
      } finally {
        button.disabled = false;
      }
    }
  });
})();
