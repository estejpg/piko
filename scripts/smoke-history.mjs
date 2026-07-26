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

function createStorageMock() {
  const store = new Map();
  return {
    local: {
      get(keys, callback) {
        const requested = Array.isArray(keys) ? keys : [keys];
        const result = {};
        for (const key of requested) {
          if (store.has(key)) result[key] = store.get(key);
        }
        callback(result);
      },
      set(value, callback) {
        for (const [key, entry] of Object.entries(value || {})) {
          store.set(key, entry);
        }
        if (typeof callback === "function") callback();
      }
    },
    _store: store
  };
}

const chrome = { storage: createStorageMock() };
const sandbox = {
  chrome,
  console,
  window: {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

const historyPath = path.join(root, "src/shared/downloadHistory.js");
const code = fs.readFileSync(historyPath, "utf8");
vm.runInNewContext(code, sandbox, { filename: historyPath });

const history = sandbox.IgBulkDownloadHistory;
assert(history && typeof history.record === "function", "IgBulkDownloadHistory.record missing");
assert(typeof history.list === "function", "IgBulkDownloadHistory.list missing");
assert(typeof history.getLastBatch === "function", "IgBulkDownloadHistory.getLastBatch missing");

(async () => {
  const batch = await history.record(
    [
      {
        id: "entry-1",
        filename: "demo_user_1.jpg",
        directoryName: "Piko",
        mediaType: "image"
      },
      {
        id: "entry-2",
        filename: "demo_user_2.jpg",
        directoryName: "Piko",
        mediaType: "image"
      }
    ],
    { source: "smoke", directoryName: "Piko", savedAt: 1700000000 }
  );

  assert(batch && Array.isArray(batch.entries) && batch.entries.length === 2, "record did not return a batch");

  const listed = await history.list();
  assert(listed.length === 2, `expected 2 history entries, got ${listed.length}`);
  assert(listed[0].filename === "demo_user_1.jpg", "list order/filename mismatch");

  const lastBatch = await history.getLastBatch();
  assert(lastBatch && lastBatch.entries.length === 2, "getLastBatch missing entries");
  assert(lastBatch.directoryName === "Piko", "getLastBatch directory mismatch");
  assert(lastBatch.entries[0].id === "entry-1", "getLastBatch entry id mismatch");

  console.log("smoke-history.mjs OK");
})().catch((error) => {
  fail(error && error.stack ? error.stack : String(error));
});
