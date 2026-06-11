(function () {
  const FETCH_TIMEOUT_MS = 12000;
  const PANEL_WAIT_MS = 15000;
  const PANEL_SCROLL_MS = 9000;
  const TIMESTAMP_RE = /^\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?$/;
  const INLINE_TIMESTAMP_RE = /^(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)\s+([\s\S]+)$/;

  function log(message, detail) {
    if (detail === undefined) console.log(`[Piko transcript] ${message}`);
    else console.log(`[Piko transcript] ${message}`, detail);
  }

  function warn(message, detail) {
    if (detail === undefined) console.warn(`[Piko transcript] ${message}`);
    else console.warn(`[Piko transcript] ${message}`, detail);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeLine(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function decodeHtmlEntities(text) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = String(text || "");
    return textarea.value;
  }

  function parseTimestampToSeconds(timestamp) {
    const value = String(timestamp || "").trim();
    if (!value) return null;
    const parts = value.split(":");
    if (parts.length < 2 || parts.length > 3) return null;

    const [hoursRaw, minutesRaw, secondsRaw] = parts.length === 3 ? parts : ["0", parts[0], parts[1]];
    const secondsParts = secondsRaw.split(".");
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    const seconds = Number(secondsParts[0]);
    const millis = Number((secondsParts[1] || "0").padEnd(3, "0").slice(0, 3));

    if (![hours, minutes, seconds, millis].every((part) => Number.isFinite(part))) return null;
    return hours * 3600 + minutes * 60 + seconds + millis / 1000;
  }

  function formatTimestamp(seconds) {
    if (!Number.isFinite(seconds)) return "";
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(secs).padStart(2, "0");
    return hours ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
  }

  function* deepElementIterator(root) {
    const stack = [root || document.documentElement];

    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;

      const isElement = node.nodeType === Node.ELEMENT_NODE;
      const canContainElements =
        isElement || node.nodeType === Node.DOCUMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE;

      if (canContainElements) {
        if (node.shadowRoot) stack.push(node.shadowRoot);
        const children = node.children ? Array.from(node.children) : [];
        for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);
      }

      if (isElement) yield node;
    }
  }

  function deepQueryAll(root, predicate) {
    const matches = [];
    for (const element of deepElementIterator(root || document)) {
      try {
        if (predicate(element)) matches.push(element);
      } catch (error) {
        // Ignore detached or partially upgraded YouTube elements while scanning.
      }
    }
    return matches;
  }

  function queryDeep(selector, root) {
    try {
      const direct = (root || document).querySelector && (root || document).querySelector(selector);
      if (direct) return direct;
    } catch (error) {
      // Continue into shadow roots.
    }

    return deepQueryAll(root || document, (element) => element.matches && element.matches(selector))[0] || null;
  }

  function visibleEnough(element) {
    if (!element || !element.isConnected) return false;
    const style = window.getComputedStyle ? window.getComputedStyle(element) : null;
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    const rect = element.getBoundingClientRect ? element.getBoundingClientRect() : null;
    return !rect || rect.width > 0 || rect.height > 0;
  }

  function clickElement(element) {
    if (!element) return false;
    const target = element.closest && element.closest("button, tp-yt-paper-button, ytd-menu-service-item-renderer, tp-yt-paper-item, a");
    const clickable = target || element;
    if (clickable.disabled || clickable.getAttribute("aria-disabled") === "true") return false;
    if (!visibleEnough(clickable)) return false;
    clickable.click();
    return true;
  }

  function isPikoElement(element) {
    return Boolean(element && element.closest && element.closest("#ig-bulk-youtube-control, .ig-bulk-youtube-control"));
  }

  function transcriptKeywordText(element) {
    const text = [
      element && element.getAttribute && element.getAttribute("aria-label"),
      element && element.getAttribute && element.getAttribute("title"),
      element && element.textContent,
      element && element.outerHTML
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      text.includes("show transcript") ||
      text.includes("transcript") ||
      text.includes("transkript") ||
      text.includes("transcripción") ||
      text.includes("bản ghi") ||
      text.includes("phụ đề") ||
      text.includes("字幕") ||
      text.includes("searchable-transcript") ||
      text.includes("gettranscriptendpoint") ||
      text.includes("engagement-panel-searchable-transcript")
    );
  }

  function parseTranscriptJson(jsonText) {
    let data = null;
    try {
      data = JSON.parse(jsonText);
    } catch (error) {
      return "";
    }

    if (!data || !Array.isArray(data.events)) return "";

    const lines = [];
    data.events.forEach((event) => {
      if (!Array.isArray(event.segs)) return;
      const line = normalizeLine(event.segs.map((segment) => segment && segment.utf8 ? segment.utf8 : "").join(""));
      if (!line) return;
      const timestamp = Number.isFinite(Number(event.tStartMs)) ? formatTimestamp(Number(event.tStartMs) / 1000) : "";
      lines.push(timestamp ? `[${timestamp}] ${line}` : line);
    });

    return lines.join("\n");
  }

  function parseTranscriptXml(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const textNodes = doc.querySelectorAll("text, p");

    if (!textNodes.length) return "";

    const lines = [];
    textNodes.forEach((node) => {
      const line = normalizeLine(node.textContent);
      if (!line) return;
      const start = Number(node.getAttribute("start") || node.getAttribute("t"));
      const timestamp = Number.isFinite(start) ? formatTimestamp(node.hasAttribute("t") ? start / 1000 : start) : "";
      lines.push(timestamp ? `[${timestamp}] ${line}` : line);
    });

    return lines.join("\n");
  }

  function parseTranscriptVtt(vttText) {
    const body = String(vttText || "");
    if (!/^\s*WEBVTT\b/i.test(body) && !body.includes("-->")) return "";

    const lines = [];
    body
      .split(/\r?\n/)
      .forEach((line) => {
        const value = normalizeLine(line);
        if (!value || value === "WEBVTT" || value.includes("-->") || /^\d+$/.test(value)) return;
        lines.push(decodeHtmlEntities(value.replace(/<[^>]*>/g, "")));
      });
    return lines.join("\n");
  }

  function parseTranscriptText(body) {
    return parseTranscriptJson(body) || parseTranscriptXml(body) || parseTranscriptVtt(body);
  }

  function segmentFromParts(timestamp, text, fallbackOrder) {
    let normalizedText = normalizeLine(text);
    let normalizedTimestamp = normalizeLine(timestamp);

    if (!normalizedTimestamp) {
      const inline = normalizedText.match(INLINE_TIMESTAMP_RE);
      if (inline) {
        normalizedTimestamp = inline[1];
        normalizedText = normalizeLine(inline[2]);
      }
    }

    if (!normalizedText || TIMESTAMP_RE.test(normalizedText)) return null;

    const start = parseTimestampToSeconds(normalizedTimestamp);
    return {
      start,
      timestamp: start == null ? "" : normalizedTimestamp,
      text: normalizedText,
      order: fallbackOrder
    };
  }

  function textWithoutTimestamp(text, timestamp) {
    let value = normalizeLine(text);
    if (timestamp) value = normalizeLine(value.replace(new RegExp(`^${timestamp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`), ""));
    const inline = value.match(INLINE_TIMESTAMP_RE);
    if (inline) return normalizeLine(inline[2]);
    return value;
  }

  function timestampFromRow(row) {
    if (!row) return "";

    const selector =
      ".segment-timestamp, [class*='segment-timestamp'], [class*='timestamp'], yt-formatted-string.segment-timestamp";
    const timestampElement = row.querySelector && row.querySelector(selector);
    const timestampText = normalizeLine(timestampElement && timestampElement.textContent);
    if (TIMESTAMP_RE.test(timestampText)) return timestampText;

    const deepTimestampElement = deepQueryAll(row, (element) => TIMESTAMP_RE.test(normalizeLine(element.textContent)))[0];
    const deepTimestamp = normalizeLine(deepTimestampElement && deepTimestampElement.textContent);
    if (TIMESTAMP_RE.test(deepTimestamp)) return deepTimestamp;

    const inline = normalizeLine(row.textContent).match(INLINE_TIMESTAMP_RE);
    return inline ? inline[1] : "";
  }

  function segmentTextFromRow(row, timestamp) {
    if (!row) return "";

    const textElement =
      (row.querySelector &&
        row.querySelector(
          ".segment-text, [class*='segment-text'], .yt-core-attributed-string, yt-formatted-string:not(.segment-timestamp)"
        )) ||
      null;

    const text = textElement ? textElement.textContent : row.textContent;
    return textWithoutTimestamp(text, timestamp);
  }

  function dedupeSegments(segments) {
    const deduped = [];
    const seen = new Set();

    segments.forEach((segment, index) => {
      if (!segment || !segment.text) return;
      const key = `${segment.timestamp || ""}|${segment.text}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push({ ...segment, order: segment.order == null ? index : segment.order });
    });

    return deduped.sort((a, b) => {
      if (a.start != null && b.start != null && a.start !== b.start) return a.start - b.start;
      return a.order - b.order;
    });
  }

  function segmentsToText(segments) {
    const deduped = dedupeSegments(segments);
    return deduped
      .map((segment) => {
        const timestamp = segment.timestamp || (segment.start == null ? "" : formatTimestamp(segment.start));
        return timestamp ? `[${timestamp}] ${segment.text}` : segment.text;
      })
      .join("\n");
  }

  function segmentsHaveText(segments) {
    return Array.isArray(segments) && segments.some((segment) => segment && segment.text && !TIMESTAMP_RE.test(segment.text));
  }

  function findTranscriptPanelRoot() {
    const selectors = [
      "ytd-transcript-search-panel-renderer",
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]',
      "#engagement-panel-searchable-transcript",
      "ytd-transcript-renderer",
      "ytd-transcript-segment-list-renderer",
      "#panels ytd-engagement-panel-section-list-renderer"
    ];

    for (const selector of selectors) {
      const element = queryDeep(selector);
      if (element && visibleEnough(element)) return element;
    }

    const byTranscriptTarget = deepQueryAll(document, (element) => {
      const targetId = normalizeLine(element.getAttribute && element.getAttribute("target-id")).toLowerCase();
      return targetId.includes("transcript");
    }).find(visibleEnough);

    return byTranscriptTarget || null;
  }

  function collectTranscriptPanelCandidates() {
    const candidates = new Set();
    const add = (element) => {
      if (element && element.nodeType === Node.ELEMENT_NODE && visibleEnough(element)) candidates.add(element);
    };

    add(findTranscriptPanelRoot());
    add(queryDeep("#panels"));

    deepQueryAll(document, (element) => {
      const tag = (element.tagName || "").toLowerCase();
      const targetId = normalizeLine(element.getAttribute && element.getAttribute("target-id")).toLowerCase();
      return tag.includes("transcript") || targetId.includes("transcript");
    }).forEach(add);

    return Array.from(candidates);
  }

  function parsePlainTranscriptText(text) {
    const lines = String(text || "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map(normalizeLine)
      .filter(Boolean);
    const segments = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^(transcript|show transcript)$/i.test(line)) continue;

      const inline = line.match(INLINE_TIMESTAMP_RE);
      if (inline) {
        const segment = segmentFromParts(inline[1], inline[2], index);
        if (segment) segments.push(segment);
        continue;
      }

      if (TIMESTAMP_RE.test(line) && lines[index + 1] && !TIMESTAMP_RE.test(lines[index + 1])) {
        const segment = segmentFromParts(line, lines[index + 1], index);
        if (segment) segments.push(segment);
        index += 1;
      }
    }

    return dedupeSegments(segments);
  }

  function scrapeTranscriptRows(root) {
    const scope = root || findTranscriptPanelRoot() || document;
    const rowSelectors = [
      "ytd-transcript-segment-renderer",
      "transcript-segment-view-model",
      "yt-list-item-view-model",
      "[class*='transcript-segment']",
      "[role='listitem']"
    ];
    const rows = [];
    const seen = new Set();

    rowSelectors.forEach((selector) => {
      deepQueryAll(scope, (element) => element.matches && element.matches(selector)).forEach((row) => {
        if (seen.has(row)) return;
        seen.add(row);
        rows.push(row);
      });
    });

    const segments = [];
    rows.forEach((row, index) => {
      const timestamp = timestampFromRow(row);
      const text = segmentTextFromRow(row, timestamp);
      const segment = segmentFromParts(timestamp, text, index);
      if (segment) segments.push(segment);
    });

    return dedupeSegments(segments);
  }

  function scrapeTranscriptFromDom() {
    let bestSegments = [];

    for (const root of collectTranscriptPanelCandidates()) {
      const rowSegments = scrapeTranscriptRows(root);
      if (rowSegments.length > bestSegments.length) bestSegments = rowSegments;

      const plainSegments = parsePlainTranscriptText(root.innerText || root.textContent || "");
      if (plainSegments.length > bestSegments.length) bestSegments = plainSegments;
    }

    return bestSegments;
  }

  function getTranscriptScrollContainer() {
    const root = findTranscriptPanelRoot();
    if (!root) return null;

    const selectors = [
      "#segments-container",
      "#body",
      "#content",
      "ytd-transcript-segment-list-renderer",
      "ytd-transcript-search-panel-renderer #body"
    ];

    for (const selector of selectors) {
      const element = root.querySelector && root.querySelector(selector);
      if (element && (element.scrollHeight > element.clientHeight || element.children.length)) return element;
    }

    const scrollable = deepQueryAll(root, (element) => element.scrollHeight > element.clientHeight + 20)[0];
    return scrollable || root;
  }

  async function scrollTranscriptPanelToLoadAll(maxMs) {
    const container = getTranscriptScrollContainer();
    if (!container) {
      warn("Transcript scroll container was not found");
      return scrapeTranscriptFromDom();
    }

    log("Scrolling transcript panel to load all rows");
    const started = Date.now();
    let allSegments = dedupeSegments(scrapeTranscriptFromDom());
    let stableRounds = 0;
    let lastSignature = "";

    container.scrollTop = 0;
    container.dispatchEvent(new Event("scroll", { bubbles: true }));
    await sleep(250);

    while (Date.now() - started < maxMs && stableRounds < 5) {
      const currentSegments = scrapeTranscriptFromDom();
      allSegments = dedupeSegments(allSegments.concat(currentSegments));

      const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
      const beforeTop = Math.round(container.scrollTop);
      const nearBottom = beforeTop >= maxTop - 4;
      const step = Math.max(450, Math.round((container.clientHeight || 700) * 0.85));
      container.scrollTop = nearBottom ? container.scrollHeight : Math.min(maxTop, beforeTop + step);
      container.dispatchEvent(new Event("scroll", { bubbles: true }));
      await sleep(350);

      const nextSegments = scrapeTranscriptFromDom();
      allSegments = dedupeSegments(allSegments.concat(nextSegments));

      const signature = `${allSegments.length}|${Math.round(container.scrollTop)}|${container.scrollHeight}`;
      if (nearBottom && signature === lastSignature) stableRounds += 1;
      else stableRounds = 0;
      lastSignature = signature;
    }

    log("Transcript panel scroll complete", { rows: allSegments.length });
    return allSegments;
  }

  async function openTranscriptPanel() {
    if (segmentsHaveText(scrapeTranscriptFromDom())) {
      log("Transcript panel already appears to be open");
      return true;
    }

    log("Trying to open YouTube transcript panel");

    const expand =
      queryDeep("#expand") ||
      queryDeep("tp-yt-paper-button#expand") ||
      deepQueryAll(document, (element) => {
        const label = normalizeLine(element.getAttribute && element.getAttribute("aria-label")).toLowerCase();
        return element.matches && element.matches("button, tp-yt-paper-button") && label.includes("show more");
      })[0];

    if (clickElement(expand)) {
      log("Expanded video description");
      await sleep(450);
    }

    const descriptionTranscript = queryDeep("ytd-video-description-transcript-section-renderer");
    if (clickElement(descriptionTranscript)) {
      log("Clicked description transcript section");
      await sleep(700);
      return true;
    }

    const directTranscriptButton = deepQueryAll(document, (element) => {
      if (!(element.matches && element.matches("button, tp-yt-paper-button, ytd-button-renderer button"))) return false;
      if (isPikoElement(element)) return false;
      return transcriptKeywordText(element);
    }).find(visibleEnough);

    if (clickElement(directTranscriptButton)) {
      log("Clicked direct transcript button");
      await sleep(700);
      return true;
    }

    for (const menuItem of deepQueryAll(document, (element) => {
      return element.matches && element.matches("ytd-menu-service-item-renderer, tp-yt-paper-item") && transcriptKeywordText(element);
    })) {
      if (clickElement(menuItem)) {
        log("Clicked existing transcript menu item");
        await sleep(700);
        return true;
      }
    }

    const moreButton = deepQueryAll(document, (element) => {
      if (!(element.matches && element.matches("button, ytd-menu-renderer button, #button-shape button"))) return false;
      if (isPikoElement(element)) return false;
      const label = normalizeLine(
        [
          element.getAttribute && element.getAttribute("aria-label"),
          element.getAttribute && element.getAttribute("title"),
          element.textContent
        ]
          .filter(Boolean)
          .join(" ")
      ).toLowerCase();
      return label.includes("more actions") || label === "more" || label.includes("action menu");
    }).find(visibleEnough);

    if (clickElement(moreButton)) {
      log("Opened YouTube more-actions menu");
      await sleep(600);
      const transcriptMenuItem = deepQueryAll(document, (element) => {
        return element.matches && element.matches("ytd-menu-service-item-renderer, tp-yt-paper-item") && transcriptKeywordText(element);
      }).find(visibleEnough);

      if (clickElement(transcriptMenuItem)) {
        log("Clicked transcript item from more-actions menu");
        await sleep(900);
        return true;
      }
    }

    warn("Could not open transcript panel automatically");
    return false;
  }

  async function waitForTranscriptRows(maxMs) {
    const started = Date.now();
    let bestSegments = [];

    while (Date.now() - started < maxMs) {
      const segments = scrapeTranscriptFromDom();
      if (segments.length > bestSegments.length) bestSegments = segments;
      if (segmentsHaveText(segments)) return segments;
      await sleep(250);
    }

    return bestSegments;
  }

  async function extractTranscriptFromPanel() {
    const opened = await openTranscriptPanel();
    if (!opened) {
      throw new Error('Could not open YouTube transcript panel automatically. Open "Show transcript" manually and retry.');
    }

    const initialSegments = await waitForTranscriptRows(PANEL_WAIT_MS);
    if (!segmentsHaveText(initialSegments)) {
      throw new Error("Transcript panel opened, but no transcript rows appeared.");
    }

    const loadedSegments = await scrollTranscriptPanelToLoadAll(PANEL_SCROLL_MS);
    const finalSegments = loadedSegments.length >= initialSegments.length ? loadedSegments : initialSegments;

    if (!segmentsHaveText(finalSegments)) {
      throw new Error("Transcript panel was empty or only contained timestamps.");
    }

    const text = segmentsToText(finalSegments);
    if (!text) {
      throw new Error("Transcript panel rows were detected, but no readable text could be extracted.");
    }

    log("Extracted transcript from YouTube panel", { rows: finalSegments.length });
    return text;
  }

  function extractBalancedJson(text, startIndex) {
    let depth = 0;
    let inString = false;
    let stringQuote = "";
    let escaped = false;

    for (let index = startIndex; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === stringQuote) {
          inString = false;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringQuote = char;
        continue;
      }

      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) return text.slice(startIndex, index + 1);
      }
    }

    return "";
  }

  function parsePlayerResponse(value) {
    if (!value) return null;

    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch (error) {
        return null;
      }
    }

    if (value.args && value.args.player_response) return parsePlayerResponse(value.args.player_response);
    if (value.captions || value.captionTracks) return value;
    return null;
  }

  function isPlayerResponseForVideo(playerResponse, videoId) {
    const responseVideoId = playerResponse && playerResponse.videoDetails && playerResponse.videoDetails.videoId;
    return !videoId || !responseVideoId || responseVideoId === videoId;
  }

  function readPlayerResponseFromDom(videoId) {
    const candidates = [
      document.querySelector("ytd-watch-flexy"),
      document.querySelector("ytd-player"),
      document.querySelector("#movie_player")
    ];

    for (const node of candidates) {
      if (!node) continue;
      let nodePlayerResponse = null;
      try {
        nodePlayerResponse = typeof node.getPlayerResponse === "function" ? node.getPlayerResponse() : null;
      } catch (error) {
        nodePlayerResponse = null;
      }

      const values = [
        node.playerData,
        node.playerResponse,
        node.__data && node.__data.playerResponse,
        nodePlayerResponse
      ];

      for (const value of values) {
        const playerResponse = parsePlayerResponse(value);
        if (playerResponse && isPlayerResponseForVideo(playerResponse, videoId)) return playerResponse;
      }
    }

    return null;
  }

  function readPlayerResponseFromScripts(videoId) {
    const patterns = [
      /(?:var\s+)?ytInitialPlayerResponse\s*=\s*\{/g,
      /window\[['"]ytInitialPlayerResponse['"]\]\s*=\s*\{/g
    ];

    for (const script of document.scripts || []) {
      const content = script.textContent || "";
      if (!content.includes("ytInitialPlayerResponse") || !content.includes("captionTracks")) continue;

      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match = pattern.exec(content);
        while (match) {
          const objectStart = content.indexOf("{", match.index);
          const jsonText = objectStart >= 0 ? extractBalancedJson(content, objectStart) : "";
          const playerResponse = parsePlayerResponse(jsonText);
          if (playerResponse && isPlayerResponseForVideo(playerResponse, videoId)) return playerResponse;
          match = pattern.exec(content);
        }
      }
    }

    return null;
  }

  function findPlayerResponse(videoId) {
    const candidates = [
      parsePlayerResponse(window.ytInitialPlayerResponse) ||
      parsePlayerResponse(window.ytplayer && window.ytplayer.config) ||
      null,
      readPlayerResponseFromDom(videoId),
      readPlayerResponseFromScripts(videoId)
    ];
    return candidates.find((playerResponse) => playerResponse && isPlayerResponseForVideo(playerResponse, videoId)) || null;
  }

  function findCaptionTracks(videoId) {
    try {
      const playerResponse = findPlayerResponse(videoId);
      const tracks =
        (playerResponse &&
          playerResponse.captions &&
          playerResponse.captions.playerCaptionsTracklistRenderer &&
          playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks) ||
        (playerResponse && playerResponse.captionTracks) ||
        [];

      return Array.isArray(tracks) && tracks.length ? tracks : null;
    } catch (error) {
      console.warn("Error finding caption tracks:", error);
      return null;
    }
  }

  function selectBestTrack(tracks) {
    if (!tracks || !tracks.length) return null;
    
    const english = tracks.find((track) => {
      const lang = (track.languageCode || "").toLowerCase();
      return lang === "en" || lang.startsWith("en-");
    });
    if (english) return english;
    
    const notAsr = tracks.find((track) => track.kind !== "asr");
    if (notAsr) return notAsr;
    
    return tracks[0];
  }

  function transcriptUrl(track, format) {
    const rawUrl = track && (track.baseUrl || track.url);
    if (!rawUrl) return "";

    try {
      const url = new URL(rawUrl, location.href);
      if (format && !url.searchParams.has("fmt") && !url.searchParams.has("format")) {
        url.searchParams.set("fmt", format);
      }
      return url.toString();
    } catch (error) {
      if (!format || rawUrl.includes("fmt=") || rawUrl.includes("format=")) return rawUrl;
      return `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}fmt=${encodeURIComponent(format)}`;
    }
  }

  async function fetchTranscriptText(track) {
    const url = transcriptUrl(track, "json3");
    if (!url) {
      throw new Error("Invalid transcript track");
    }

    const candidates = [url];
    const originalUrl = transcriptUrl(track);
    if (originalUrl && originalUrl !== url) candidates.push(originalUrl);

    let lastError = null;
    for (const candidateUrl of candidates) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(candidateUrl, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Transcript request failed: ${response.status}`);
        }

        const body = await response.text();
        const transcript = parseTranscriptText(body);
        if (transcript) return transcript;
        lastError = new Error("Transcript response was empty");
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError || new Error("Could not download transcript");
  }

  async function extractTranscript(videoId) {
    const errors = [];

    try {
      const panelText = await extractTranscriptFromPanel();
      return {
        text: panelText,
        language: "unknown",
        isAutoGenerated: false,
        source: "transcript-panel"
      };
    } catch (error) {
      warn("Panel transcript extraction failed", error);
      errors.push(error.message || String(error));
    }

    log("Trying caption-track fallback");
    try {
      const tracks = findCaptionTracks(videoId);

      if (!tracks || !tracks.length) {
        throw new Error("No caption tracks found in YouTube player data.");
      }

      const selectedTrack = selectBestTrack(tracks);
      if (!selectedTrack) {
        throw new Error("Could not select a transcript track.");
      }

      const transcript = await fetchTranscriptText(selectedTrack);

      if (!transcript) {
        throw new Error("Caption-track transcript response was empty.");
      }

      log("Extracted transcript from caption-track fallback", {
        language: selectedTrack.languageCode || "unknown",
        isAutoGenerated: selectedTrack.kind === "asr"
      });

      return {
        text: transcript,
        language: selectedTrack.languageCode || "unknown",
        isAutoGenerated: selectedTrack.kind === "asr",
        source: "caption-track"
      };
    } catch (error) {
      warn("Caption-track transcript fallback failed", error);
      errors.push(error.message || String(error));
    }

    const detail = errors.filter(Boolean).join(" ");
    if (/Could not open YouTube transcript panel automatically/.test(detail)) {
      throw new Error('Could not open YouTube transcript panel automatically. Open "Show transcript" manually, wait for transcript rows, then retry.');
    }

    throw new Error(
      `No usable transcript was found for this video.${detail ? ` ${detail}` : ""} Try opening "Show transcript" manually and retrying.`
    );
  }

  async function checkTranscriptAvailable() {
    return Boolean(findTranscriptPanelRoot() || findCaptionTracks());
  }

  window.IgBulkYouTubeTranscript = {
    extractTranscript,
    checkTranscriptAvailable
  };
})();
