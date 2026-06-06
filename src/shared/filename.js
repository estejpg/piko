(function () {
  const SAFE_EXT_RE = /\.([0-9a-z]+)(?:[?#]|$)/i;

  function sanitizeFilenamePart(value) {
    return String(value || "unknown")
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 120);
  }

  function extensionFromUrl(url, mediaType) {
    const match = String(url || "").match(SAFE_EXT_RE);
    if (match) return match[1].toLowerCase();
    return mediaType === "video" ? "mp4" : "jpg";
  }

  function applyPattern(items, settings) {
    const defaults = window.IG_BULK_DEFAULT_SETTINGS || { filenamePattern: "{username}_{takenAt}_{id}" };
    const pattern = (settings && settings.filenamePattern) || defaults.filenamePattern;
    const groupCounts = items.reduce((counts, item) => {
      if (item.sourcePostId) counts.set(item.sourcePostId, (counts.get(item.sourcePostId) || 0) + 1);
      return counts;
    }, new Map());
    const usedFilenames = new Map();

    return items.map((item, index) => {
      const ext = item.filename && item.filename.includes(".") ? item.filename.split(".").pop() : extensionFromUrl(item.url, item.mediaType);
      const order = Number(item.order || index + 1);
      const orderLabel = String(order).padStart(2, "0");
      const base = pattern
        .replaceAll("{username}", item.ownerUsername || "instagram")
        .replaceAll("{takenAt}", String(item.takenAt || Date.now()))
        .replaceAll("{id}", String(item.id || Date.now()))
        .replaceAll("{type}", item.mediaType || "media")
        .replaceAll("{index}", orderLabel);

      const isGroupedItem = item.sourcePostId && groupCounts.get(item.sourcePostId) > 1;
      const orderedBase = isGroupedItem && !pattern.includes("{index}") ? `${base}_${orderLabel}` : base;
      let filename = `${sanitizeFilenamePart(orderedBase)}.${ext}`;
      const duplicateCount = usedFilenames.get(filename) || 0;
      usedFilenames.set(filename, duplicateCount + 1);
      if (duplicateCount > 0) {
        const suffix = String(duplicateCount + 1).padStart(2, "0");
        filename = `${sanitizeFilenamePart(orderedBase)}_${suffix}.${ext}`;
      }

      return {
        ...item,
        filename
      };
    });
  }

  window.IgBulkFilename = {
    applyPattern,
    extensionFromUrl,
    sanitizeFilenamePart
  };
})();
