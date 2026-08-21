#!/usr/bin/env node

// Smoke coverage for the Instagram media resolver: shortcode/media-id math,
// REST API payload normalization, URL parsing, and story route parsing.

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

function loadScript(relativePath, sandbox) {
  const absolutePath = path.join(root, relativePath);
  const code = fs.readFileSync(absolutePath, "utf8");
  vm.runInNewContext(code, sandbox, { filename: absolutePath });
}

const storage = new Map();
const sandbox = {
  console,
  URL,
  location: { origin: "https://www.instagram.com", pathname: "/demo_user/" },
  sessionStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value))
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

loadScript("src/shared/messages.js", sandbox);
loadScript("src/shared/filename.js", sandbox);
loadScript("src/media/mediaResolver.js", sandbox);

const resolver = sandbox.IgBulkMediaResolver;
assert(resolver, "IgBulkMediaResolver missing");

// --- shortcode <-> media id -------------------------------------------------
// Base64url positional math: "B" -> 1, "CA" -> 2*64 + 0 = 128.
assert(resolver.mediaIdFromShortcode("B") === "1", `expected "B" -> 1, got ${resolver.mediaIdFromShortcode("B")}`);
assert(resolver.mediaIdFromShortcode("CA") === "128", `expected "CA" -> 128, got ${resolver.mediaIdFromShortcode("CA")}`);
assert(resolver.mediaIdFromShortcode("") === "", "empty shortcode should resolve to empty id");
assert(resolver.mediaIdFromShortcode("!!bad!!") === "", "invalid characters should resolve to empty id");

// Roundtrip across a realistic 11-character shortcode.
const roundtripCode = "CxKvXQWJ8Wf";
const roundtripId = resolver.mediaIdFromShortcode(roundtripCode);
assert(/^\d+$/.test(roundtripId), `media id should be numeric, got ${roundtripId}`);
assert(
  resolver.shortcodeFromMediaId(roundtripId) === roundtripCode,
  `roundtrip mismatch: ${roundtripCode} -> ${roundtripId} -> ${resolver.shortcodeFromMediaId(roundtripId)}`
);

// Share links append a 28-character suffix after the real shortcode.
const shareCode = roundtripCode + "x".repeat(28);
assert(
  resolver.mediaIdFromShortcode(shareCode) === roundtripId,
  "share-link shortcode should be trimmed to the real shortcode"
);

// --- REST payload normalization ----------------------------------------------
const carouselItem = {
  pk: "3141592653589793238",
  id: "3141592653589793238_99",
  taken_at: 1700000100,
  user: { username: "demo_user" },
  carousel_media: [
    {
      pk: "111",
      media_type: 1,
      image_versions2: {
        candidates: [
          { url: "https://cdn.example/low.jpg", width: 640, height: 800 },
          { url: "https://cdn.example/high.jpg", width: 1440, height: 1800 }
        ]
      }
    },
    {
      pk: "222",
      media_type: 2,
      video_versions: [
        { url: "https://cdn.example/video-hd.mp4", width: 1080, height: 1920 },
        { url: "https://cdn.example/video-sd.mp4", width: 480, height: 854 }
      ],
      image_versions2: { candidates: [{ url: "https://cdn.example/poster.jpg", width: 720, height: 1280 }] }
    }
  ]
};

const carousel = resolver.normalizeApiMedia(carouselItem);
assert(carousel.length === 2, `expected 2 carousel items, got ${carousel.length}`);
assert(carousel[0].url === "https://cdn.example/high.jpg", "should pick the highest-resolution image candidate");
assert(carousel[0].mediaType === "image", "first carousel child should be an image");
assert(carousel[1].url === "https://cdn.example/video-hd.mp4", "should pick the highest-resolution video version");
assert(carousel[1].mediaType === "video", "second carousel child should be a video");
assert(carousel[0].order === 1 && carousel[1].order === 2, "carousel order should be preserved");
assert(carousel[0].sourcePostId === "3141592653589793238", "carousel children should share the parent post id");
assert(carousel[0].ownerUsername === "demo_user", "owner should come from the API payload");

const singleVideo = resolver.normalizeApiMedia({
  pk: "555",
  media_type: 2,
  taken_at: 1700000200,
  user: { username: "demo_user" },
  video_versions: [{ url: "https://cdn.example/reel.mp4", width: 1080, height: 1920 }]
});
assert(singleVideo.length === 1 && singleVideo[0].mediaType === "video", "single video item should normalize");

assert(resolver.normalizeApiMedia(null).length === 0, "null API item should normalize to []");
assert(
  resolver.normalizeApiMedia({ pk: "777", media_type: 1 }).length === 0,
  "item without candidates should normalize to []"
);

// Filenames flow through the shared pattern tooling with unique carousel names.
const named = sandbox.IgBulkFilename.applyPattern(carousel, { filenamePattern: "{username}_{takenAt}_{id}" });
assert(named[0].filename !== named[1].filename, "carousel filenames should be unique");
assert(named[0].filename.startsWith("demo_user_"), `unexpected filename: ${named[0].filename}`);

// --- URL and route parsing ----------------------------------------------------
assert(resolver.shortcodeFromUrl("https://www.instagram.com/p/ABC123/") === "ABC123", "p url parse failed");
assert(resolver.shortcodeFromUrl("https://www.instagram.com/reel/XYZ_9-/?igsh=1") === "XYZ_9-", "reel url parse failed");
assert(resolver.shortcodeFromUrl("https://www.instagram.com/reels/DEF456/") === "DEF456", "reels-feed url parse failed");
assert(resolver.shortcodeFromUrl("/tv/GHI789") === "GHI789", "tv path parse failed");
assert(resolver.shortcodeFromUrl("https://www.instagram.com/demo_user/") === null, "profile url should not parse as shortcode");

const userStory = resolver.parseStoryRoute("/stories/demo_user/3141592653589793238/");
assert(userStory && userStory.kind === "user" && userStory.username === "demo_user", "user story route parse failed");
assert(userStory.mediaId === "3141592653589793238", "user story media id parse failed");

const highlightStory = resolver.parseStoryRoute("/stories/highlights/17900000000000000/");
assert(highlightStory && highlightStory.kind === "highlight" && highlightStory.highlightId === "17900000000000000", "highlight route parse failed");
assert(resolver.parseStoryRoute("/explore/") === null, "non-story route should not parse");

// --- misc helpers ---------------------------------------------------------------
const deduped = resolver.dedupeByUrl([
  { url: "https://cdn.example/a.jpg" },
  { url: "https://cdn.example/a.jpg" },
  { url: "https://cdn.example/b.jpg" }
]);
assert(deduped.length === 2, "dedupeByUrl should drop duplicate URLs");

console.log("smoke-instagram.mjs OK");
