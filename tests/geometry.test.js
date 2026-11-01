import { test } from "node:test";
import assert from "node:assert/strict";
import { foldGeometry, clampPoint } from "../src/geometry.js";
const area = (p) =>
  Math.abs(
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a.x * b.y - a.y * b.x;
    }, 0) / 2,
  );
test("bisector partitions a page exactly", () => {
  for (const p of [
    { x: 90, y: 20 },
    { x: -55, y: 150 },
    { x: 0, y: 0 },
    { x: 45, y: 260 },
  ]) {
    const f = foldGeometry(100, 200, { x: 100, y: 200 }, p);
    assert.ok(Math.abs(area(f.peeled) + area(f.unpeeled) - 20000) < 1e-6);
    assert.ok(Math.abs(area(f.reflected) - area(f.peeled)) < 1e-6);
  }
});
test("reflection is involutory and maps anchor to pointer", () => {
  const c = { x: 100, y: 200 },
    p = { x: -20, y: 140 },
    f = foldGeometry(100, 200, c, p),
    [a, b, c1, d, tx, ty] = f.matrix;
  const reflect = (p) => ({
    x: a * p.x + c1 * p.y + tx,
    y: b * p.x + d * p.y + ty,
  });
  const r = reflect(c);
  assert.ok(Math.hypot(r.x - p.x, r.y - p.y) < 1e-8);
  const rr = reflect(r);
  assert.ok(Math.hypot(rr.x - c.x, rr.y - c.y) < 1e-8);
});
test("spine constraints do not stretch paper for any anchor", () => {
  for (const y of [0, 100, 200])
    for (const p of [
      { x: 500, y: 500 },
      { x: -500, y: -500 },
      { x: 50, y: 100 },
    ]) {
      const q = clampPoint(p, 100, 200, y);
      assert.ok(Math.hypot(q.x, q.y) <= Math.hypot(100, y) + 1e-5);
      assert.ok(Math.hypot(q.x, q.y - 200) <= Math.hypot(100, 200 - y) + 1e-5);
    }
});
