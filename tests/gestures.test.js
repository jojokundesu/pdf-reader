import { test } from "node:test";
import assert from "node:assert/strict";
import {
  horizontalIntent,
  interiorFoldPoint,
  completeTurn,
} from "../src/gestures.js";
test("anywhere drag intent waits for horizontal movement, never just a hold or vertical motion", () => {
  assert.equal(horizontalIntent(0, 0), false);
  assert.equal(horizontalIntent(7, 0), false);
  assert.equal(horizontalIntent(30, 60), false);
  assert.equal(horizontalIntent(-30, 4), true);
  assert.equal(horizontalIntent(30, -4), true);
});
test("middle-page fold begins at the edge and follows relative movement in either direction", () => {
  const start = { x: 180, y: 300 },
    rect = { width: 300, height: 400 };
  assert.deepEqual(
    interiorFoldPoint(
      600,
      800,
      400,
      start,
      { clientX: 180, clientY: 300 },
      rect,
      false,
    ),
    { x: 600, y: 400 },
  );
  assert.deepEqual(
    interiorFoldPoint(
      600,
      800,
      400,
      start,
      { clientX: 120, clientY: 320 },
      rect,
      false,
    ),
    { x: 480, y: 440 },
  );
  assert.deepEqual(
    interiorFoldPoint(
      600,
      800,
      400,
      start,
      { clientX: 240, clientY: 320 },
      rect,
      true,
    ),
    { x: 480, y: 440 },
  );
});
test("short held interior drags return; deliberate swipes finish; cancellation always returns", () => {
  const base = {
    interior: true,
    progress: 0.1,
    velocity: 0,
    distance: 20,
    horizontalDistance: 20,
    pageWidth: 300,
    canceled: false,
  };
  assert.equal(completeTurn(base), false);
  assert.equal(completeTurn({ ...base, horizontalDistance: 80 }), true);
  assert.equal(completeTurn({ ...base, velocity: -0.8 }), true);
  assert.equal(
    completeTurn({ ...base, horizontalDistance: 120, canceled: true }),
    false,
  );
  assert.equal(completeTurn({ ...base, interior: false, distance: 0 }), true);
});
