#!/usr/bin/env node

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

const sandbox = {
  __PIKO_TEST__: true,
  AbortController,
  URL,
  clearTimeout,
  console,
  location: { href: "https://www.youtube.com/watch?v=test" },
  setTimeout
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

const transcriptPath = path.join(root, "src/media/youtubeTranscript.js");
vm.runInNewContext(fs.readFileSync(transcriptPath, "utf8"), sandbox, { filename: transcriptPath });

const testApi = sandbox.IgBulkYouTubeTranscript && sandbox.IgBulkYouTubeTranscript.__test;
assert(testApi, "YouTube transcript test API missing");

function panelElement({ targetId = "", hasTranscriptRows = false } = {}) {
  return {
    tagName: "YTD-ENGAGEMENT-PANEL-SECTION-LIST-RENDERER",
    getAttribute(name) {
      return name === "target-id" ? targetId : null;
    },
    querySelector() {
      return hasTranscriptRows ? {} : null;
    }
  };
}

const chapterPanel = panelElement({ targetId: "engagement-panel-macro-markers-description-chapters" });
assert(!testApi.isTranscriptPanelElement(chapterPanel), "chapter panel was accepted as a transcript panel");

const targetlessModernPanel = panelElement({ hasTranscriptRows: true });
assert(testApi.isTranscriptPanelElement(targetlessModernPanel), "modern targetless transcript panel was rejected");

const legacyTranscriptPanel = panelElement({ targetId: "engagement-panel-searchable-transcript" });
assert(testApi.isTranscriptPanelElement(legacyTranscriptPanel), "legacy transcript target was rejected");

const modernRow = {
  textContent: "0:000 secondsSpoken caption text, not a chapter title.",
  querySelector(selector) {
    if (selector.includes("TranscriptSegment") && selector.includes("Timestamp")) {
      return { textContent: "0:00" };
    }
    if (selector.includes("ytAttributedStringHost")) {
      return { textContent: "Spoken caption text, not a chapter title." };
    }
    return null;
  }
};

assert(testApi.timestampFromRow(modernRow) === "0:00", "modern transcript timestamp was not parsed");
assert(
  testApi.segmentTextFromRow(modernRow, "0:00") === "Spoken caption text, not a chapter title.",
  "modern transcript row included timestamp accessibility text"
);

const chapterLikeText = "0:00\nIntro and Outline\n5:32\nCatholic Upbringing";
assert(
  testApi.parsePlainTranscriptText(chapterLikeText).length === 2,
  "chapter-shaped text no longer exercises the false-positive parser"
);

console.log("smoke-youtube-transcript.mjs OK");
