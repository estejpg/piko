(function () {
  const pageTitle = document.querySelector('[data-role="page-title"]');
  const pageDetail = document.querySelector('[data-role="page-detail"]');
  const statusDot = document.querySelector('[data-role="status-dot"]');
  const folder = document.querySelector('[data-role="folder"]');

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

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "settings") chrome.runtime.openOptionsPage();
    if (action === "instagram") chrome.tabs.create({ url: "https://www.instagram.com/" });
    if (action === "youtube") chrome.tabs.create({ url: "https://www.youtube.com/" });
  });
})();
