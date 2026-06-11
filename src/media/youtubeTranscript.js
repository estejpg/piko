(function () {
  const FETCH_TIMEOUT_MS = 12000;

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
      if (line) lines.push(line);
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
      if (line) lines.push(line);
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
    const tracks = findCaptionTracks(videoId);
    
    if (!tracks || !tracks.length) {
      throw new Error("No transcript available for this video");
    }
    
    const selectedTrack = selectBestTrack(tracks);
    if (!selectedTrack) {
      throw new Error("Could not select a transcript track");
    }
    
    const transcript = await fetchTranscriptText(selectedTrack);
    
    if (!transcript) {
      throw new Error("Failed to parse transcript");
    }
    
    return {
      text: transcript,
      language: selectedTrack.languageCode || "unknown",
      isAutoGenerated: selectedTrack.kind === "asr"
    };
  }

  async function checkTranscriptAvailable() {
    const tracks = findCaptionTracks();
    return tracks && tracks.length > 0;
  }

  window.IgBulkYouTubeTranscript = {
    extractTranscript,
    checkTranscriptAvailable
  };
})();
