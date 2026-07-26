#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

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

function collectManifestPaths(manifest) {
  const paths = new Set();
  if (manifest.options_page) paths.add(manifest.options_page);
  if (manifest.background && manifest.background.service_worker) {
    paths.add(manifest.background.service_worker);
  }
  if (manifest.action && manifest.action.default_popup) {
    paths.add(manifest.action.default_popup);
  }
  for (const script of manifest.content_scripts || []) {
    for (const js of script.js || []) paths.add(js);
    for (const css of script.css || []) paths.add(css);
  }
  return [...paths];
}

const manifestPath = path.join(root, "manifest.json");
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (error) {
  fail(`manifest.json did not parse: ${error.message}`);
}

const missing = collectManifestPaths(manifest).filter((entry) => !fs.existsSync(path.join(root, entry)));
assert(missing.length === 0, `missing manifest paths: ${missing.join(", ")}`);

const sandbox = {
  window: {},
  console
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

loadScript("src/shared/messages.js", sandbox);
loadScript("src/shared/filename.js", sandbox);

assert(sandbox.IgBulkFilename && typeof sandbox.IgBulkFilename.applyPattern === "function", "IgBulkFilename.applyPattern missing");
assert(Array.isArray(sandbox.IG_BULK_FILENAME_PRESETS), "IG_BULK_FILENAME_PRESETS missing");
assert(sandbox.IG_BULK_FILENAME_PRESETS.length >= 4, "expected at least 4 filename presets");

const defaults = sandbox.IG_BULK_DEFAULT_SETTINGS;
assert(defaults && defaults.filenamePattern === "{username}_{takenAt}_{id}", "default filename pattern mismatch");
const defaultPreset = sandbox.IG_BULK_FILENAME_PRESETS.find((preset) => preset.id === "default");
assert(defaultPreset, "default filename preset missing");
assert(defaultPreset.pattern === defaults.filenamePattern, "default preset pattern does not match defaults");

const sample = sandbox.IgBulkFilename.applyPattern(
  [
    {
      id: "abc123",
      ownerUsername: "demo_user",
      takenAt: 1700000000,
      mediaType: "image",
      url: "https://example.com/photo.jpg",
      order: 1
    }
  ],
  { filenamePattern: defaults.filenamePattern }
);

assert(Array.isArray(sample) && sample.length === 1, "applyPattern did not return one item");
assert(sample[0].filename === "demo_user_1700000000_abc123.jpg", `unexpected filename: ${sample[0].filename}`);

console.log("smoke.mjs OK");
