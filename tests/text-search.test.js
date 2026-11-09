import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalPageText,
  findTextMatches,
  normalizeSearchText,
  textItemOffsets,
} from "../src/text-search.js";

test("page text joins PDF text runs in reading order", () => {
  const items = [{ str: "A search" }, { str: "phrase" }, { str: "across" }];
  assert.equal(canonicalPageText(items), "A search phrase across");
  assert.deepEqual(textItemOffsets(items), [
    { start: 0, end: 8 },
    { start: 9, end: 15 },
    { start: 16, end: 22 },
  ]);
});

test("search finds every occurrence and reports original text offsets", () => {
  assert.deepEqual(findTextMatches("Rudeus met Rudeus; rudeus!", "rudeus"), [
    { start: 0, end: 6 },
    { start: 11, end: 17 },
    { start: 19, end: 25 },
  ]);
});

test("search normalizes line breaks, repeated whitespace and Unicode width", () => {
  assert.equal(normalizeSearchText("  ＦlipVault\n  Pro  "), "flipvault pro");
  assert.deepEqual(findTextMatches("A\n  phrase in a PDF", "phrase in"), [
    { start: 4, end: 13 },
  ]);
});

test("Unicode compatibility expansions still map to the original glyph range", () => {
  assert.deepEqual(findTextMatches("A ﬁle on a page", "file"), [
    { start: 2, end: 5 },
  ]);
});

test("empty queries do not match everything", () => {
  assert.deepEqual(findTextMatches("anything", "   "), []);
});
