import test from "node:test";
import assert from "node:assert/strict";
import {
  validateArtwork,
  pickArtwork,
  newArtwork,
  ART_RULES,
} from "../src/backgrounds.js";

test("artwork below the minimum size or with an extreme shape is rejected", () => {
  assert.deepEqual(validateArtwork({ width: 1080, height: 1920 }), {
    width: 1080,
    height: 1920,
    aspect: 0.5625,
  });
  assert.throws(
    () => validateArtwork({ width: 640, height: 1200, name: "strip.jpg" }),
    /at least 800/,
  );
  assert.throws(
    () => validateArtwork({ width: 2400, height: 900 }),
    /too wide/,
  );
  assert.throws(
    () => validateArtwork({ width: 900, height: 2400 }),
    /too tall/,
  );
  assert.throws(
    () => validateArtwork({ width: 0, height: 0 }),
    /not an image/,
  );
  assert.throws(
    () =>
      validateArtwork({
        width: 1200,
        height: 1600,
        bytes: ART_RULES.maxBytes + 1,
      }),
    /under 12 MB/,
  );
});

test("rotation picks from the chosen set and avoids repeating the last image", () => {
  const a = newArtwork({ dataUrl: "data:a", width: 1000, height: 1600, name: "A" });
  const b = newArtwork({ dataUrl: "data:b", width: 1000, height: 1600, name: "B" });
  const library = {
    images: [a, b],
    home: a.id,
    reader: null,
    rotate: false,
  };
  assert.equal(pickArtwork(library, "home").id, a.id);
  // The reading room has no artwork of its own yet, so it stays plain.
  assert.equal(pickArtwork(library, "reader"), null);
  const both = { ...library, reader: a.id };
  assert.equal(pickArtwork(both, "reader").id, a.id);
  const rotating = { ...both, rotate: true };
  assert.equal(pickArtwork(rotating, "home", a.id).id, b.id);
  const picks = new Set();
  for (let i = 0; i < 40; i++)
    picks.add(pickArtwork(rotating, "reader", null).id);
  assert.deepEqual([...picks].sort(), [a.id, b.id].sort());
  assert.equal(pickArtwork({ images: [] }, "home"), null);
});
