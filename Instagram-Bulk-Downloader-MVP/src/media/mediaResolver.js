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

  function candidateArea(candidate) {
    return (candidate.width || candidate.config_width || 0) * (candidate.height || candidate.config_height || 0);
  }

  function bestCandidateUrl(candidates) {
    if (!Array.isArray(candidates) || !candidates.length) return "";
    const candidate = candidates
      .filter(Boolean)
      .slice()
      .sort((a, b) => candidateArea(b) - candidateArea(a))[0];
    return (candidate && (candidate.url || candidate.src)) || "";
  }

  function bestImageUrl(node) {
    if (!node) return "";
    return (
      bestCandidateUrl(node.display_resources) ||
      bestCandidateUrl(node.image_versions2 && node.image_versions2.candidates) ||
      bestCandidateUrl(node.image_versions && node.image_versions.candidates) ||
      node.display_url ||
      node.thumbnail_src ||
      node.src ||
      ""
    );
  }

  function bestVideoUrl(node) {
    if (!node) return "";
    return node.video_url || bestCandidateUrl(node.video_versions) || "";
  }

  function ownerUsername(node, parent) {
    return (
      (node && node.owner && node.owner.username) ||
      (node && node.user && node.user.username) ||
      (parent && parent.owner && parent.owner.username) ||
      (parent && parent.user && parent.user.username) ||
      "instagram"
    );
  }

  function takenAtTimestamp(node, parent) {
    return (
      (node && (node.taken_at_timestamp || node.taken_at)) ||
      (parent && (parent.taken_at_timestamp || parent.taken_at)) ||
      Math.floor(Date.now() / 1000)
    );
  }

  function mediaNodeId(node, parent, index) {
    return (
      (node && (node.id || node.pk || node.code || node.shortcode)) ||
      (parent && (parent.id || parent.pk || parent.code || parent.shortcode)) ||
      `${Date.now()}-${index + 1}`
    );
  }

  function isVideoNode(node) {
    return Boolean(node && (node.is_video || node.video_url || node.media_type === 2 || (node.video_versions && node.video_versions.length)));
  }

  function normalizeMediaNode(node, parent, index) {
    const order = Number.isFinite(index) ? index + 1 : 1;
    const owner = ownerUsername(node, parent);
    const takenAt = takenAtTimestamp(node, parent);
    const mediaType = isVideoNode(node) ? "video" : "image";
    const url = mediaType === "video" ? bestVideoUrl(node) : bestImageUrl(node);
    const id = mediaNodeId(node, parent, index || 0);
    if (!url) return null;
    return buildMediaItem({
      id,
      ownerUsername: owner,
      takenAt,
      mediaType,
      url,
      order,
      sourcePostId: parent && (parent.id || parent.pk || parent.shortcode || parent.code)
    });
  }

  function normalizeThumbnailNode(node, parent, index) {
    const order = Number.isFinite(index) ? index + 1 : 1;
    const owner = ownerUsername(node, parent);
    const takenAt = takenAtTimestamp(node, parent);
    const url = bestImageUrl(node);
    const id = `${mediaNodeId(node, parent, index || 0)}-thumbnail`;
    if (!url) return null;
    return buildMediaItem({
      id,
      ownerUsername: owner,
      takenAt,
      mediaType: "image",
      url,
      order,
      sourcePostId: parent && (parent.id || parent.pk || parent.shortcode || parent.code)
    });
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

  function normalizePost(post) {
    if (!post) return [];
    const children = post.edge_sidecar_to_children && post.edge_sidecar_to_children.edges;
    if (children && children.length) {
      return children.map((edge, index) => normalizeMediaNode(edge.node || edge, post, index)).filter(Boolean);
    }
    if (Array.isArray(post.carousel_media)) {
      return post.carousel_media.map((item, index) => normalizeMediaNode(item, post, index)).filter(Boolean);
    }
    if (post.carousel_media && Array.isArray(post.carousel_media.edges)) {
      return post.carousel_media.edges.map((edge, index) => normalizeMediaNode(edge.node || edge, post, index)).filter(Boolean);
    }
    return [normalizeMediaNode(post, post, 0)].filter(Boolean);
  }

  function normalizePostThumbnails(post) {
    if (!post) return [];
    const children = post.edge_sidecar_to_children && post.edge_sidecar_to_children.edges;
    if (children && children.length) {
      return children.map((edge, index) => normalizeThumbnailNode(edge.node || edge, post, index)).filter(Boolean);
    }
    if (Array.isArray(post.carousel_media)) {
      return post.carousel_media.map((item, index) => normalizeThumbnailNode(item, post, index)).filter(Boolean);
    }
    if (post.carousel_media && Array.isArray(post.carousel_media.edges)) {
      return post.carousel_media.edges.map((edge, index) => normalizeThumbnailNode(edge.node || edge, post, index)).filter(Boolean);
    }
    return [normalizeThumbnailNode(post, post, 0)].filter(Boolean);
  }

  function shortcodeFromUrl(url) {
    try {
      const path = new URL(url, location.origin).pathname;
      const match = path.match(/\/(?:p|reel|tv)\/([^/?#]+)/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  function collectProfileShortcodes() {
    const anchors = Array.from(document.querySelectorAll("a[href*='/p/'], a[href*='/reel/'], a[href*='/tv/']"));
    const unique = new Map();
    anchors.forEach((anchor) => {
      const shortcode = shortcodeFromUrl(anchor.href);
      if (shortcode && !unique.has(shortcode)) unique.set(shortcode, anchor.href);
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
          id: node.getAttribute("data-ig-bulk-media-id") || index,
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

  function collectVisibleDomThumbnails(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const candidates = Array.from(scope.querySelectorAll("article img, main img, article video, main video"));
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const items = [];

    candidates.forEach((node, index) => {
      const rect = node.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
      if (!visible || rect.width < 80 || rect.height < 80) return;
      const url = node.tagName === "VIDEO" ? node.getAttribute("poster") : node.currentSrc || node.src;
      if (!url || url.startsWith("data:")) return;
      items.push(
        buildMediaItem({
          id: `${node.getAttribute("data-ig-bulk-media-id") || index}-thumbnail`,
          ownerUsername: usernameFromPath() || "instagram",
          takenAt: Math.floor(Date.now() / 1000),
          mediaType: "image",
          url,
          order: index + 1
        })
      );
    });

    return dedupeByUrl(items);
  }

  function usernameFromPath() {
    const match = location.pathname.match(/^\/([^/?#]+)\/?/);
    if (!match) return null;
    const reserved = new Set(["", "p", "reel", "tv", "stories", "explore", "direct", "accounts"]);
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

  async function fetchPostFallback(shortcode) {
    const query = encodeURIComponent(JSON.stringify({ shortcode }));
    const response = await fetch(
      `https://www.instagram.com/graphql/query/?query_hash=477b65a610463740ccdb83135b2014db&variables=${query}`
    );
    if (!response.ok) throw new Error(`Instagram fallback failed: ${response.status}`);
    const data = await response.json();
    return data && data.data && data.data.shortcode_media;
  }

  window.IgBulkMediaResolver = {
    buildMediaItem,
    collectProfileShortcodes,
    collectVisibleDomMedia,
    dedupeByUrl,
    fetchPostFallback,
    collectVisibleDomThumbnails,
    normalizePost,
    normalizePostThumbnails,
    sanitizeFilenamePart,
    shortcodeFromUrl,
    usernameFromPath
  };
})();
