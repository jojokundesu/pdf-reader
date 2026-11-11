import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  fingerprint,
  openDB,
  put,
  get,
  all,
  restoreVault,
  vaultData,
  validateState,
} from "../src/storage.js";
const state = {
  pdfHash: "a".repeat(64),
  lastPage: 7,
  zoomLevel: 1.5,
  readingMode: "single",
  theme: "sepia",
  paperclips: [
    {
      id: "clip-1",
      page: 7,
      position: 0.8,
      edge: "top",
      color: "#b9c6ce",
      note: "Remember this",
      quote: "A passage attached to this comment.",
    },
  ],
  pageAnnotations: {
    7: [
      {
        id: "stroke1",
        tool: "marker",
        width: 18,
        opacity: 0.38,
        color: "#FFEB3B",
        points: [
          { x: 10, y: 20 },
          { x: 80, y: 20 },
        ],
      },
    ],
  },
};
test("fingerprints are content-derived, deterministic and detect sampled changes", async () => {
  const a = new Uint8Array(400000);
  a[210000] = 5;
  const b = a.slice();
  assert.equal(await fingerprint(a.buffer), await fingerprint(b.buffer));
  b[210000] = 6;
  assert.notEqual(await fingerprint(a.buffer), await fingerprint(b.buffer));
});
test("IndexedDB reading state and full vault round trip", async () => {
  await openDB();
  await put("readingState", state);
  assert.deepEqual(await get("readingState", state.pdfHash), state);
  const backup = await vaultData();
  assert.equal(backup.states.length, 1);
  const changed = structuredClone(backup);
  changed.states[0].lastPage = 11;
  await restoreVault(changed);
  assert.equal((await all("readingState"))[0].lastPage, 11);
});
test("malformed or hostile backup data is rejected before writes", async () => {
  assert.throws(() =>
    validateState({
      ...state,
      paperclips: [{ ...state.paperclips[0], color: '" onload="alert(1)' }],
    }),
  );
  assert.throws(() =>
    validateState({
      ...state,
      paperclips: [{ ...state.paperclips[0], quote: "x".repeat(5001) }],
    }),
  );
  assert.throws(() =>
    validateState({ ...state, pageAnnotations: { __proto__: [], abc: [] } }),
  );
  await assert.rejects(restoreVault({ format: "Other", states: [] }));
});

test("saved text highlights validate, and legacy stroke states still restore", () => {
  const highlights = {
    ...state,
    pageAnnotations: undefined,
    textHighlights: {
      7: [
        {
          id: "h-1",
          color: "#ffe066",
          text: "A passage worth keeping.",
          rects: [{ x: 0.1, y: 0.2, w: 0.5, h: 0.03 }],
          createdAt: Date.now(),
        },
      ],
    },
  };
  assert.equal(validateState(highlights), true);
  assert.equal(validateState({ ...state, textHighlights: {} }), true);
  assert.throws(() =>
    validateState({
      ...highlights,
      textHighlights: { 7: [{ ...highlights.textHighlights[7][0], color: "yellow" }] },
    }),
  );
  assert.throws(() =>
    validateState({
      ...highlights,
      textHighlights: { 7: [{ ...highlights.textHighlights[7][0], rects: [{ x: 0.9, y: 0, w: 4, h: 1 }] }] },
    }),
  );
  assert.throws(() =>
    validateState({
      ...highlights,
      textHighlights: { 7: [{ ...highlights.textHighlights[7][0], text: "x".repeat(5001) }] },
    }),
  );
});
