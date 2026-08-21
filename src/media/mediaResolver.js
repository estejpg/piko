(function () {
  // Instagram media resolution, rebuilt around Instagram's own web REST API.
  //
  // Strategy (in order of preference):
  //   1. Decode the numeric media id straight from the shortcode (pure base64 math,
  //      no network and no page-runtime dependency), then GET
  //      /api/v1/media/{id}/info/ with the web app-id/claim headers.
  //   2. For elements without permalinks, use the media id the MAIN-world bridge
  //      tagged onto the DOM (data-ig-bulk-media-id) with the same info endpoint.
  //   3. As a last resort, collect media URLs already rendered in the DOM.
  //
  // Profile bulk downloads paginate /api/v1/feed/user/{username}/username/ so they
  // cover the entire profile instead of only the tiles that happen to be rendered.
  const SAFE_EXT_RE = /\.([0-9a-z]+)(?:[?#]|$)/i;
  const SHORTCODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  // Instagram's public web app id; used only when the bridge stash is unavailable.
  const FALLBACK_WEB_APP_ID = "936619743392459";
  const APP_ID_KEY = "__piko_ig_app_id";
  const CLAIM_KEY = "__piko_ig_www_claim";
  const MEDIA_ID_ATTR = "data-ig-bulk-media-id";

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

  function mediaIdFromShortcode(shortcode) {
    let code = String(shortcode || "");
    if (!code) return "";
    // Share links append a 28-character suffix after the real shortcode.
    if (code.length > 28) code = code.slice(0, code.length - 28);
    let id = 0n;
    for (const char of code) {
      const value = SHORTCODE_ALPHABET.indexOf(char);
      if (value < 0) return "";
      id = id * 64n + BigInt(value);
    }
    return id.toString();
  }

  function shortcodeFromMediaId(mediaId) {
    let id;
    try {
      id = BigInt(String(mediaId || ""));
    } catch (error) {
      return "";
    }
    if (id <= 0n) return "";
    let code = "";
    while (id > 0n) {
      code = SHORTCODE_ALPHABET[Number(id % 64n)] + code;
      id /= 64n;
    }
    return code;
  }

  function storedHeader(key) {
    try {
      return sessionStorage.getItem(key) || "";
    } catch (error) {
      return "";
    }
  }

  function apiHeaders() {
    const headers = {
      accept: "*/*",
      "x-ig-app-id": storedHeader(APP_ID_KEY) || FALLBACK_WEB_APP_ID
    };
    // Instagram's web app persists its own claim under www-claim-v2.
    const claim = storedHeader(CLAIM_KEY) || storedHeader("www-claim-v2");
    if (claim) headers["x-ig-www-claim"] = claim;
    return headers;
  }

  async function apiGet(path, params) {
    const url = new URL(path, "https://www.instagram.com");
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: apiHeaders(),
      credentials: "include"
    });

    if (response.status === 429) {
      const error = new Error("Instagram is temporarily limiting requests. Please try again in a few minutes.");
      error.code = "RATE_LIMITED";
      throw error;
    }
    if (!response.ok) {
      const error = new Error(`Instagram API request failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function bestVersionUrl(candidates) {
    if (!Array.isArray(candidates) || !candidates.length) return "";
    let best = null;
    for (const candidate of candidates) {
      if (!candidate || !candidate.url) continue;
      if (!best || (candidate.width || 0) * (candidate.height || 0) > (best.width || 0) * (best.height || 0)) {
        best = candidate;
      }
    }
    return (best && best.url) || "";
  }

  function isVideoApiItem(item) {
    return Boolean(item && ((item.video_versions && item.video_versions.length) || item.media_type === 2));
  }

  function ownerFromApiItem(item, parent) {
    return (
      (item && item.user && item.user.username) ||
      (item && item.owner && item.owner.username) ||
      (parent && parent.user && parent.user.username) ||
      (parent && parent.owner && parent.owner.username) ||
      ""
    );
  }

  function normalizeApiChild(child, parent, index, fallbackUsername) {
    if (!child) return null;
    const mediaType = isVideoApiItem(child) ? "video" : "image";
    const url =
      mediaType === "video"
        ? bestVersionUrl(child.video_versions)
        : bestVersionUrl(child.image_versions2 && child.image_versions2.candidates);
    if (!url) return null;

    return buildMediaItem({
      id: child.pk || child.id || `${Date.now()}-${index + 1}`,
      ownerUsername: ownerFromApiItem(child, parent) || fallbackUsername || "instagram",
      takenAt: child.taken_at || (parent && parent.taken_at) || Math.floor(Date.now() / 1000),
      mediaType,
      url,
      order: index + 1,
      sourcePostId: (parent && (parent.pk || parent.id)) || ""
    });
  }

  function normalizeApiMedia(item, options) {
    if (!item) return [];
    const fallbackUsername = options && options.fallbackUsername;
    if (Array.isArray(item.carousel_media) && item.carousel_media.length) {
      return item.carousel_media
        .map((child, index) => normalizeApiChild(child, item, index, fallbackUsername))
        .filter(Boolean);
    }
    return [normalizeApiChild(item, item, 0, fallbackUsername)].filter(Boolean);
  }

  async function fetchMediaInfoById(mediaId) {
    if (!mediaId) return null;
    const data = await apiGet(`/api/v1/media/${mediaId}/info/`);
    return (data && Array.isArray(data.items) && data.items[0]) || null;
  }

  async function fetchPostItems(shortcode) {
    const mediaId = mediaIdFromShortcode(shortcode);
    if (!mediaId) return [];
    const item = await fetchMediaInfoById(mediaId);
    return normalizeApiMedia(item);
  }

  async function fetchMediaItemsById(mediaId) {
    const item = await fetchMediaInfoById(mediaId);
    return normalizeApiMedia(item);
  }

  async function fetchUserInfo(username) {
    if (!username) return null;
    const data = await apiGet("/api/v1/users/web_profile_info/", { username });
    const user = data && data.data && data.data.user;
    if (!user) return null;
    return {
      id: String(user.id || user.pk || ""),
      username: user.username || username,
      totalPosts: (user.edge_owner_to_timeline_media && user.edge_owner_to_timeline_media.count) || 0
    };
  }

  async function fetchProfileFeedPage(username, maxId) {
    const data = await apiGet(`/api/v1/feed/user/${encodeURIComponent(username)}/username/`, {
      count: 12,
      max_id: maxId || undefined
    });
    const rawItems = data && Array.isArray(data.items) ? data.items : [];
    const items = [];
    rawItems.forEach((item) => items.push(...normalizeApiMedia(item)));
    return {
      items,
      nextMaxId: data && data.more_available && data.next_max_id ? String(data.next_max_id) : ""
    };
  }

  async function fetchStoryItems(options) {
    const username = options && options.username;
    const highlightId = options && options.highlightId;
    const mediaId = options && options.mediaId ? String(options.mediaId) : "";
    const all = Boolean(options && options.all);

    let reelId = "";
    if (highlightId) {
      reelId = `highlight:${highlightId}`;
    } else {
      // A user's story reel id is their numeric user id.
      const user = await fetchUserInfo(username);
      reelId = user && user.id;
    }
    if (!reelId) return [];

    const data = await apiGet("/api/v1/feed/reels_media/", {
      reel_ids: reelId,
      media_id: mediaId || undefined
    });

    const reel =
      (Array.isArray(data && data.reels_media) && data.reels_media[0]) ||
      (data && data.reels && data.reels[reelId]) ||
      null;
    const items = reel && Array.isArray(reel.items) ? reel.items : [];
    const reelUser = (reel && reel.user) || null;
    const wanted = !all && mediaId ? items.filter((item) => String(item.pk || item.id) === mediaId) : items;
    const source = wanted.length ? wanted : items;

    const normalized = [];
    source.forEach((item) => {
      normalized.push(
        ...normalizeApiMedia(item, { fallbackUsername: (reelUser && reelUser.username) || username })
      );
    });
    return normalized;
  }

  function buildMediaItem(input) {
    const ext = extensionFromUrl(input.url, input.mediaType);
    const filename = [
      sanitizeFilenamePart(input.ownerUsername || "instagram"),
      sanitizeFilenamePart(input.takenAt || Date.now()),
      sanitizeFilenamePart(input.id || Date.now())
    ].join("_") + "." + ext;

    return {
      id: String(input.id || Date.now()),
      ownerUsername: input.ownerUsername || "instagram",
      takenAt: input.takenAt || Math.floor(Date.now() / 1000),
      mediaType: input.mediaType || (ext === "mp4" ? "video" : "image"),
      url: input.url,
      filename,
      order: input.order || 1,
      sourcePostId: input.sourcePostId || ""
    };
  }

  function shortcodeFromUrl(url) {
    try {
      const path = new URL(url, location.origin).pathname;
      const match = path.match(/\/(?:p|reels?|tv)\/([^/?#]+)/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  function mediaIdFromElement(root) {
    if (!root || !root.querySelectorAll) return "";
    if (root.getAttribute && root.getAttribute(MEDIA_ID_ATTR)) return root.getAttribute(MEDIA_ID_ATTR);
    const marked = root.querySelector(`[${MEDIA_ID_ATTR}]`);
    return (marked && marked.getAttribute(MEDIA_ID_ATTR)) || "";
  }

  function collectProfileShortcodes(options) {
    const visibleOnly = Boolean(options && options.visibleOnly);
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const anchors = Array.from(document.querySelectorAll("a[href*='/p/'], a[href*='/reel/'], a[href*='/tv/']"));
    const unique = new Map();
    anchors.forEach((anchor) => {
      const shortcode = shortcodeFromUrl(anchor.href);
      if (!shortcode || unique.has(shortcode)) return;
      if (visibleOnly) {
        const rect = anchor.getBoundingClientRect();
        const visible = rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
        if (!visible || rect.width < 40 || rect.height < 40) return;
      }
      unique.set(shortcode, anchor.href);
    });
    return Array.from(unique.keys());
  }

  function collectVisibleDomMedia() {
    const candidates = Array.from(document.querySelectorAll("article video, article img, main video, main img"));
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const items = [];

    candidates.forEach((node, index) => {
      const rect = node.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
      if (!visible || rect.width < 80 || rect.height < 80) return;
      const url = node.currentSrc || node.src;
      if (!url || url.startsWith("data:")) return;
      const mediaType = node.tagName === "VIDEO" ? "video" : "image";
      items.push(
        buildMediaItem({
          id: node.getAttribute(MEDIA_ID_ATTR) || index,
          ownerUsername: usernameFromPath() || "instagram",
          takenAt: Math.floor(Date.now() / 1000),
          mediaType,
          url,
          order: index + 1
        })
      );
    });

    return dedupeByUrl(items);
  }

  function collectDomMediaWithin(root) {
    if (!root || !root.querySelectorAll) return [];
    const nodes = Array.from(root.querySelectorAll("video, img"));
    const items = nodes
      .map((node, index) => {
        const rect = node.getBoundingClientRect();
        if (rect.width < 80 || rect.height < 80) return null;
        const url = node.currentSrc || node.src;
        if (!url || url.startsWith("data:")) return null;
        return buildMediaItem({
          id: node.getAttribute(MEDIA_ID_ATTR) || index,
          ownerUsername: usernameFromPath() || "instagram",
          takenAt: Math.floor(Date.now() / 1000),
          mediaType: node.tagName === "VIDEO" ? "video" : "image",
          url,
          order: index + 1
        });
      })
      .filter(Boolean);
    return dedupeByUrl(items);
  }

  function usernameFromPath() {
    const match = location.pathname.match(/^\/([^/?#]+)\/?/);
    if (!match) return null;
    const reserved = new Set(["", "p", "reel", "reels", "tv", "stories", "explore", "direct", "accounts"]);
    return reserved.has(match[1]) ? null : match[1];
  }

  function dedupeByUrl(items) {
    const seen = new Set();
    return items.filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
  }

  function parseStoryRoute(pathname) {
    const path = String(pathname || "");
    const highlight = path.match(/^\/stories\/highlights\/([^/]+)(?:\/(\d+))?\/?/);
    if (highlight) {
      return {
        type: "story",
        kind: "highlight",
        highlightId: highlight[1],
        username: "",
        mediaId: highlight[2] || ""
      };
    }
    const userStory = path.match(/^\/stories\/([^/]+)(?:\/(\d+))?\/?/);
    if (userStory && userStory[1] !== "highlights") {
      return {
        type: "story",
        kind: "user",
        username: userStory[1],
        highlightId: "",
        mediaId: userStory[2] || ""
      };
    }
    return null;
  }

  function collectVisibleStoryDomMedia(username) {
    const candidates = Array.from(document.querySelectorAll("section video, section img, [role='dialog'] video, [role='dialog'] img, main video, main img, video, img"));
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    let best = null;
    let bestArea = 0;

    candidates.forEach((node) => {
      const rect = node.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
      if (!visible || rect.width < 180 || rect.height < 180) return;
      if (node.tagName === "IMG" && String(node.alt || "").toLowerCase().includes("profile picture")) return;
      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        best = node;
      }
    });

    if (!best) return [];
    const url =
      best.tagName === "VIDEO"
        ? best.currentSrc || best.src || best.getAttribute("poster") || ""
        : best.currentSrc || best.src || "";
    if (!url || url.startsWith("data:")) return [];
    return [
      buildMediaItem({
        id: best.getAttribute(MEDIA_ID_ATTR) || `story-${Date.now()}`,
        ownerUsername: username || usernameFromPath() || "instagram",
        takenAt: Math.floor(Date.now() / 1000),
        mediaType: best.tagName === "VIDEO" ? "video" : "image",
        url,
        order: 1
      })
    ];
  }

  window.IgBulkMediaResolver = {
    buildMediaItem,
    collectDomMediaWithin,
    collectProfileShortcodes,
    collectVisibleDomMedia,
    collectVisibleStoryDomMedia,
    dedupeByUrl,
    fetchMediaItemsById,
    fetchPostItems,
    fetchProfileFeedPage,
    fetchStoryItems,
    fetchUserInfo,
    mediaIdFromElement,
    mediaIdFromShortcode,
    normalizeApiMedia,
    parseStoryRoute,
    sanitizeFilenamePart,
    shortcodeFromMediaId,
    shortcodeFromUrl,
    usernameFromPath
  };
})();
