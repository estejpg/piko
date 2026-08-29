#!/usr/bin/env node

// Regression coverage for src/media/youtubeTranscript.js.
//
// Guards against the chapter-index bug: on videos with chapters, the Chapters
// engagement panel (chapter titles + timestamps, "Sync to video time", etc.)
// used to be scraped as if it were the transcript, so saved "transcripts"
// contained only the chapter list. These tests run the extractor against a
// minimal fake watch-page DOM and assert that chapter surfaces are never
// treated as transcript content and that the caption-track fallback engages.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

// ---------------------------------------------------------------------------
// Minimal DOM stand-in (only what youtubeTranscript.js touches).
// ---------------------------------------------------------------------------

function parseCompound(compound) {
  const parts = { tag: null, ids: [], classes: [], attrs: [], nots: [] };
  const re = /^([a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:([*^$~|]?=)(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]|:not\(([^)]*)\)/;
  let rest = compound.trim();
  while (rest.length) {
    const match = rest.match(re);
    if (!match) throw new Error(`unsupported selector part: ${rest}`);
    if (match[1]) parts.tag = match[1].toLowerCase();
    else if (match[2]) parts.ids.push(match[2]);
    else if (match[3]) parts.classes.push(match[3]);
    else if (match[4]) {
      parts.attrs.push({
        name: match[4],
        op: match[5] || null,
        value: match[6] !== undefined ? match[6] : match[7] !== undefined ? match[7] : match[8]
      });
    } else if (match[9] !== undefined) parts.nots.push(match[9]);
    rest = rest.slice(match[0].length);
  }
  return parts;
}

function matchesCompound(element, compound) {
  const parts = parseCompound(compound);
  if (parts.tag && element.tagName.toLowerCase() !== parts.tag) return false;
  if (parts.ids.some((id) => element.id !== id)) return false;
  const classes = (element.className || "").split(/\s+/).filter(Boolean);
  if (parts.classes.some((cls) => !classes.includes(cls))) return false;
  for (const attr of parts.attrs) {
    const value = element.getAttribute(attr.name);
    if (value == null) return false;
    if (attr.op === "=" && value !== attr.value) return false;
    if (attr.op === "*=" && !value.includes(attr.value)) return false;
  }
  if (parts.nots.some((not) => matchesCompound(element, not))) return false;
  return true;
}

function matchesSelector(element, selector) {
  return String(selector)
    .split(",")
    .some((alternative) => {
      const compounds = alternative.trim().split(/\s+/).filter(Boolean);
      if (!compounds.length) return false;
      if (!matchesCompound(element, compounds[compounds.length - 1])) return false;
      let ancestor = element.parentElement;
      for (let index = compounds.length - 2; index >= 0; index -= 1) {
        while (ancestor && !matchesCompound(ancestor, compounds[index])) ancestor = ancestor.parentElement;
        if (!ancestor) return false;
        ancestor = ancestor.parentElement;
      }
      return true;
    });
}

class FakeElement {
  constructor(tag, attrs = {}, children = [], text = "") {
    this.tagName = tag.toUpperCase();
    this.nodeType = 1;
    this.attributes = { ...attrs };
    this.children = [];
    this.parentElement = null;
    this.ownText = text;
    this.shadowRoot = null;
    this.isConnected = true;
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.clientHeight = 0;
    this.cssDisplay = attrs.hidden ? "none" : "block";
    delete this.attributes.hidden;
    for (const child of children) this.appendChild(child);
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  get id() {
    return this.attributes.id || "";
  }

  get className() {
    return this.attributes.class || "";
  }

  get hiddenDeep() {
    return this.cssDisplay === "none" || Boolean(this.parentElement && this.parentElement.hiddenDeep);
  }

  get textContent() {
    return [this.ownText, ...this.children.map((child) => child.textContent)].filter(Boolean).join("\n");
  }

  get innerText() {
    if (this.hiddenDeep) return "";
    return [this.ownText, ...this.children.map((child) => child.innerText)].filter(Boolean).join("\n");
  }

  getAttribute(name) {
    return name in this.attributes ? this.attributes[name] : null;
  }

  hasAttribute(name) {
    return name in this.attributes;
  }

  matches(selector) {
    return matchesSelector(this, selector);
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches && node.matches(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }

  *descendants() {
    for (const child of this.children) {
      yield child;
      yield* child.descendants();
    }
  }

  querySelector(selector) {
    for (const node of this.descendants()) {
      if (node.matches(selector)) return node;
    }
    return null;
  }

  getBoundingClientRect() {
    const visible = !this.hiddenDeep;
    return { width: visible ? 10 : 0, height: visible ? 10 : 0 };
  }

  click() {
    this.clicked = true;
    if (this.onClick) this.onClick();
  }

  dispatchEvent() {
    return true;
  }
}

function el(tag, attrs, children, text) {
  return new FakeElement(tag, attrs || {}, children || [], text || "");
}

function makeSandbox(rootElement) {
  const document = {
    nodeType: 9,
    documentElement: rootElement,
    children: [rootElement],
    scripts: [],
    querySelector(selector) {
      if (rootElement.matches(selector)) return rootElement;
      return rootElement.querySelector(selector);
    },
    createElement() {
      return {
        set innerHTML(value) {
          this._value = value;
        },
        get value() {
          return this._value || "";
        }
      };
    }
  };

  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    Node: { ELEMENT_NODE: 1, DOCUMENT_NODE: 9, DOCUMENT_FRAGMENT_NODE: 11 },
    document,
    location: { href: "https://www.youtube.com/watch?v=erpKBoPQxN0" },
    // Clamp waits so panel-scroll/settle loops finish quickly in the test.
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 25)),
    clearTimeout,
    URL,
    AbortController,
    Event: class Event {
      constructor(type) {
        this.type = type;
      }
    },
    DOMParser: class DOMParser {
      parseFromString() {
        return { querySelectorAll: () => [] };
      }
    },
    getComputedStyle: (element) => ({
      display: element.cssDisplay || "block",
      visibility: "visible"
    })
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const scriptPath = path.join(root, "src/media/youtubeTranscript.js");
  vm.runInNewContext(fs.readFileSync(scriptPath, "utf8"), sandbox, { filename: scriptPath });
  return sandbox;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function chapterItem(title, time) {
  return el("ytd-macro-markers-list-item-renderer", { role: "listitem" }, [
    el("h4", { class: "macro-markers" }, [], title),
    el("div", { id: "time" }, [], time)
  ]);
}

function chaptersPanel(expanded) {
  return el(
    "ytd-engagement-panel-section-list-renderer",
    {
      "target-id": "engagement-panel-macro-markers-description-chapters",
      visibility: expanded ? "ENGAGEMENT_PANEL_VISIBILITY_EXPANDED" : "ENGAGEMENT_PANEL_VISIBILITY_HIDDEN",
      hidden: !expanded
    },
    [
      el("ytd-macro-markers-list-renderer", {}, [
        chapterItem("Intro and Outline", "0:00"),
        chapterItem("Catholic Upbringing", "5:32"),
        chapterItem("The Deconversion", "7:12")
      ]),
      el("button", {}, [], "Sync to video time")
    ]
  );
}

function transcriptSegment(time, text) {
  return el("ytd-transcript-segment-renderer", { role: "listitem" }, [
    el("div", { class: "segment-timestamp" }, [], time),
    el("yt-formatted-string", { class: "segment-text" }, [], text)
  ]);
}

function transcriptPanel() {
  return el(
    "ytd-engagement-panel-section-list-renderer",
    {
      "target-id": "engagement-panel-searchable-transcript",
      visibility: "ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"
    },
    [
      el("ytd-transcript-renderer", {}, [
        el("div", { id: "segments-container" }, [
          el("ytd-transcript-section-header-renderer", { role: "listitem" }, [], "Intro and Outline"),
          transcriptSegment("0:01", "so here's the thing about the contingency argument"),
          transcriptSegment("0:05", "today we're going to explore nine hours of philosophy")
        ])
      ])
    ]
  );
}

function watchPage(panels) {
  return el("html", {}, [
    el("ytd-watch-flexy", {}, [el("div", { id: "panels" }, panels)])
  ]);
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function scenarioChaptersOnly() {
  // Chapters panel present (closed), no transcript panel, no caption tracks:
  // extraction must fail instead of returning the chapter index.
  const sandbox = makeSandbox(watchPage([chaptersPanel(false)]));

  assert(
    (await sandbox.IgBulkYouTubeTranscript.checkTranscriptAvailable()) === false,
    "chapters-only page should not report a transcript as available"
  );

  let error = null;
  try {
    await sandbox.IgBulkYouTubeTranscript.extractTranscript("erpKBoPQxN0");
  } catch (caught) {
    error = caught;
  }

  assert(error, "chapters-only extraction should reject instead of returning chapter titles");
  assert(
    !/Catholic Upbringing|Sync to video time/.test(error.message),
    "chapters-only rejection should not embed chapter content"
  );
  console.log("scenario chapters-only OK");
}

async function scenarioTranscriptPanelWithChapters() {
  // Transcript panel open next to an expanded chapters panel: the result must be
  // the spoken rows only, never chapter titles or chapters-panel UI labels.
  const sandbox = makeSandbox(watchPage([chaptersPanel(true), transcriptPanel()]));

  assert(
    (await sandbox.IgBulkYouTubeTranscript.checkTranscriptAvailable()) === true,
    "transcript panel should report availability"
  );

  const result = await sandbox.IgBulkYouTubeTranscript.extractTranscript("erpKBoPQxN0");
  assert(result.source === "transcript-panel", `expected transcript-panel source, got ${result.source}`);

  const expected =
    "[0:01] so here's the thing about the contingency argument\n" +
    "[0:05] today we're going to explore nine hours of philosophy";
  assert(result.text === expected, `unexpected transcript text:\n${result.text}`);
  assert(!result.text.includes("Catholic Upbringing"), "transcript must not contain chapter titles");
  assert(!result.text.includes("Sync to video time"), "transcript must not contain chapters-panel UI text");
  assert(!result.text.includes("Intro and Outline"), "transcript must not contain section headers");
  console.log("scenario transcript-panel OK");
}

async function scenarioCaptionTrackFallback() {
  // Chapters panel only, but the player exposes caption tracks: extraction must
  // fall back to fetching the caption track instead of scraping chapters.
  const sandbox = makeSandbox(watchPage([chaptersPanel(true)]));

  sandbox.ytInitialPlayerResponse = {
    videoDetails: { videoId: "erpKBoPQxN0" },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            baseUrl: "https://www.youtube.com/api/timedtext?v=erpKBoPQxN0&lang=en",
            languageCode: "en",
            kind: "asr"
          }
        ]
      }
    }
  };

  const requestedUrls = [];
  sandbox.fetch = async (url) => {
    requestedUrls.push(String(url));
    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          events: [
            { tStartMs: 0, segs: [{ utf8: "hello" }, { utf8: " world" }] },
            { tStartMs: 65000, segs: [{ utf8: "more words" }] }
          ]
        })
    };
  };

  const result = await sandbox.IgBulkYouTubeTranscript.extractTranscript("erpKBoPQxN0");
  assert(result.source === "caption-track", `expected caption-track source, got ${result.source}`);
  assert(result.text === "[0:00] hello world\n[1:05] more words", `unexpected caption text:\n${result.text}`);
  assert(result.isAutoGenerated === true, "asr track should be flagged auto-generated");
  assert(
    requestedUrls.length && requestedUrls[0].includes("fmt=json3"),
    "caption fetch should request json3 format"
  );
  console.log("scenario caption-fallback OK");
}

await scenarioChaptersOnly();
await scenarioTranscriptPanelWithChapters();
await scenarioCaptionTrackFallback();
console.log("smoke-transcript.mjs OK");
