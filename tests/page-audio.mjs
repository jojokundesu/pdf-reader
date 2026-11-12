import assert from "node:assert/strict";
import { launch } from "./browser.mjs";
const browser = await launch(),
  context = await browser.newContext({
    viewport: { width: 393, height: 830 },
    hasTouch: true,
  });
const p = await context.newPage(),
  errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await context.addInitScript(() => {
  window.__pageAudio = {
    starts: [],
    decodes: 0,
    contexts: 0,
    stops: 0,
    active: 0,
    maxActive: 0,
  };
  const start = AudioBufferSourceNode.prototype.start,
    stop = AudioBufferSourceNode.prototype.stop,
    decode = AudioContext.prototype.decodeAudioData,
    Original = window.AudioContext;
  AudioBufferSourceNode.prototype.start = function (when, offset, duration) {
    const a = window.__pageAudio;
    a.starts.push({
      offset,
      duration,
      rate: this.playbackRate.value,
      bufferDuration: this.buffer?.duration,
    });
    a.active++;
    a.maxActive = Math.max(a.maxActive, a.active);
    this.addEventListener("ended", () => a.active--, { once: true });
    return start.apply(this, arguments);
  };
  AudioBufferSourceNode.prototype.stop = function () {
    window.__pageAudio.stops++;
    return stop.apply(this, arguments);
  };
  AudioContext.prototype.decodeAudioData = function () {
    window.__pageAudio.decodes++;
    return decode.apply(this, arguments);
  };
  window.AudioContext = class extends Original {
    constructor(...args) {
      super(...args);
      window.__pageAudio.contexts++;
    }
  };
});
// The app now opens on the library; this suite needs the reader open.
async function enterReader() {
  await p.waitForFunction(
    () => {
      const home = document.body.classList.contains("at-home");
      return (
        document.querySelector("#loading").hidden &&
        (!home || document.querySelectorAll("#homeGrid .home-book").length > 0) &&
        (home || document.querySelectorAll(".thumb").length)
      );
    },
    null,
    { timeout: 40000 },
  );
  await dismissFirstRunTutorial();
  if (await p.evaluate(() => document.body.classList.contains("at-home"))) {
    await p.locator("#homeContinueButton").waitFor({ state: "visible", timeout: 20000 });
    await p.locator("#homeContinueButton").click();
    await p.waitForFunction(() => !document.body.classList.contains("at-home"));
  }
}
const ready = () =>
  p.waitForFunction(
    () =>
      document.querySelectorAll(".thumb").length === 12 &&
      document.querySelector("#loading").hidden,
  );
const pageNum = (n) =>
  p.waitForFunction(
    (n) =>
      document.querySelector("#pageInput").value === String(n) &&
      document.querySelector("#loading").hidden,
    n,
  );
// The tour is marked seen just before it is shown, so the stored flag cannot
// tell us whether the dialog is about to appear. Wait for either the dialog or
// a painted library, then give the tour a beat to show up.
async function dismissFirstRunTutorial() {
  await p.waitForFunction(
    () =>
      document.querySelector("#dialog")?.open === true ||
      document.querySelectorAll("#homeGrid .home-book").length > 0,
    null,
    { timeout: 40000 },
  );
  for (let i = 0; i < 20; i++) {
    if (await p.evaluate(() => document.querySelector("#dialog")?.open === true))
      break;
    await p.waitForTimeout(100);
  }
  if (await p.locator("#tutorialSkip").isVisible().catch(() => false))
    await p.locator("#tutorialSkip").click();
  await p.waitForFunction(
    () => document.querySelector("#dialog")?.open !== true,
    null,
    { timeout: 20000 },
  );
}
// Wait until the page the reader is showing has actually reached IndexedDB, so
// a reload cannot race the save. (Playwright does not await async
// waitForFunction predicates, so this polls with evaluate().)
const persisted = async () => {
  const wanted = Number(await p.locator("#pageInput").inputValue());
  const readSavedPage = () =>
    p.evaluate(async () => {
      const db = await new Promise((resolve) => {
        const request = indexedDB.open("FlipVaultDB");
        request.onsuccess = () => resolve(request.result);
      });
      const rows = await new Promise((resolve) => {
        const request = db
          .transaction("readingState")
          .objectStore("readingState")
          .getAll();
        request.onsuccess = () => resolve(request.result);
      });
      return rows[0]?.lastPage;
    });
  for (let i = 0; i < 100; i++) {
    if ((await readSavedPage()) === wanted) return;
    await p.waitForTimeout(100);
  }
  throw new Error(`page ${wanted} was never written to readingState`);
};
const pressKey = (key) =>
  p.evaluate((key) => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
  }, key);
const starts = (n) =>
  p.waitForFunction((n) => window.__pageAudio.starts.length === n, n);
const metrics = () => p.evaluate(() => window.__pageAudio);
async function openReaderTools() {
  if (await p.locator("#focusPanel").isHidden())
    await p.locator("#focusTools").click();
  await p.waitForFunction(() => document.querySelector("#focusPanel").hidden === false);
}
async function toggleFocusSound() {
  await openReaderTools();
  await p.locator("#toolSound").click();
  await p.waitForFunction(() => document.querySelector("#focusPanel").hidden);
}
async function goToFocusPage(n) {
  await openReaderTools();
  await p.locator("#toolGoToPage").click();
  await p.locator("#focusPageInput").fill(String(n));
  await p.locator("#goToFocusPage").click();
  await pageNum(n);
}
try {
  await p.goto(process.env.TEST_URL || "http://localhost:5173");
  await enterReader();
  await ready();
  assert.equal((await metrics()).starts.length, 0);
  await pressKey("ArrowRight");
  await pageNum(2);
  await starts(1);
  let m = await metrics();
  assert.equal(m.contexts, 1);
  assert.equal(m.decodes, 1);
  assert.ok(m.starts[0].offset > 0.4 && m.starts[0].offset < 0.8);
  assert.ok(m.starts[0].duration > 1 && m.starts[0].duration < 1.7);
  assert.ok(
    m.starts[0].bufferDuration > 2.5 && m.starts[0].bufferDuration < 2.8,
  );
  assert.equal(m.starts[0].rate, 1);
  console.log(
    "PASS actual MP3 decoding, gesture unlock, quiet-head trimming and original-pitch playback",
  );
  await pressKey("ArrowRight");
  await pageNum(3);
  await starts(2);
  await toggleFocusSound();
  await p.waitForTimeout(100);
  assert.equal((await metrics()).active, 0);
  await pressKey("ArrowRight");
  await pageNum(4);
  assert.equal((await metrics()).starts.length, 2);
  assert.ok((await metrics()).stops > 0);
  assert.equal((await metrics()).decodes, 1);
  console.log("PASS buffer reuse, immediate mute and silent muted page turns");
  await persisted();
  await p.reload();
  await ready();
  await pageNum(4);
  assert.equal(await p.locator("#sound").getAttribute("aria-pressed"), "true");
  await pressKey("ArrowRight");
  await pageNum(5);
  assert.equal((await metrics()).starts.length, 0);
  assert.equal((await metrics()).contexts, 0);
  await toggleFocusSound();
  await p.waitForFunction(() => window.__pageAudio.decodes === 1);
  assert.equal((await metrics()).starts.length, 0);
  await pressKey("ArrowRight");
  await pageNum(6);
  await starts(1);
  console.log(
    "PASS mute preference survives restart; unmuting does not replay old sounds",
  );
  const r = await p.locator("#rightPage").boundingBox();
  await p.mouse.move(r.x + r.width * 0.5, r.y + r.height * 0.5);
  await p.mouse.down();
  await p.mouse.move(r.x + r.width * 0.45, r.y + r.height * 0.5, { steps: 5 });
  await p.waitForTimeout(160);
  await p.mouse.up();
  await p.waitForTimeout(1200);
  assert.equal(await p.locator("#pageInput").inputValue(), "6");
  assert.equal((await metrics()).starts.length, 1);
  await pressKey("ArrowLeft");
  await pageNum(5);
  await starts(2);
  await goToFocusPage(8);
  await starts(3);
  assert.ok((await metrics()).maxActive <= 2);
  console.log("PASS no spring-back sound; direct page jumps play exactly once");
  await p.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await p.waitForTimeout(60);
  assert.equal((await metrics()).active, 0);
  await p.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await p.waitForTimeout(100);
  assert.equal((await metrics()).starts.length, 3);
  console.log(
    "PASS backgrounding stops playback without replaying on foreground",
  );
  if (process.env.TEST_OFFLINE) {
    await p.waitForFunction(() => navigator.serviceWorker.controller);
    const hash = await p.evaluate(async () => {
      const c = await caches.open(
          (await caches.keys()).find((k) => k.startsWith("flipvault-")),
        ),
        request = (await c.keys()).find((r) => /page-turn-.*\.mp3/.test(r.url));
      if (!request) return null;
      const bytes = await (await c.match(request)).arrayBuffer();
      return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
    });
    assert.equal(
      hash,
      "543118ab2c6c9268b0ab0070ebdb1ec29d5cabd12bceeee67af184ccb3c39c51",
    );
    await p.waitForTimeout(600);
    await context.setOffline(true);
    await p.reload();
    await ready();
    await pressKey("ArrowLeft");
    await pageNum(7);
    await starts(1);
    console.log(
      "PASS exact supplied MP3 is precached and plays after an offline restart",
    );
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
