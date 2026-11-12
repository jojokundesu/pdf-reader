import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { launch } from "./browser.mjs";
mkdirSync("test-results", { recursive: true });
const browser = await launch(),
  context = await browser.newContext({
    viewport: { width: 393, height: 830 },
    isMobile: true,
    hasTouch: true,
  });
const p = await context.newPage(),
  errors = [];
p.on("pageerror", (e) => errors.push(e.message));
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
      document.querySelectorAll(".thumb").length &&
      document.querySelector("#loading").hidden,
  );
const num = () => p.locator("#pageInput").inputValue();
// Playwright does not await async waitForFunction predicates, so wait for the
// painted library (or the tour) and then dismiss the tour if it showed up.
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
async function waitPage(n) {
  await p.waitForFunction(
    (n) =>
      document.querySelector("#pageInput").value === String(n) &&
      document.querySelector("#loading").hidden,
    n,
  );
  await p.waitForTimeout(200);
}
const cdp = await context.newCDPSession(p);
async function touch(type, points) {
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
}
async function drag({
  x = 0.5,
  y = 0.5,
  dx = -0.32,
  dy = 0,
  hold = 120,
  cancel = false,
  quick = false,
  leaf = "#rightPage",
} = {}) {
  const r = await p.locator(leaf).boundingBox(),
    sx = r.x + r.width * x,
    sy = r.y + r.height * y;
  await touch("touchStart", [{ x: sx, y: sy, id: 1 }]);
  await p.waitForTimeout(hold);
  if (dx || dy) {
    const steps = quick ? 1 : 8;
    for (let i = 1; i <= steps; i++) {
      await touch("touchMove", [
        {
          x: sx + (r.width * dx * i) / steps,
          y: sy + (r.height * dy * i) / steps,
          id: 1,
        },
      ]);
      if (!quick) await p.waitForTimeout(18);
    }
  }
  if (!quick) await p.waitForTimeout(120);
  await touch(cancel ? "touchCancel" : "touchEnd", []);
}
async function openReaderTools() {
  if (await p.locator("#focusPanel").isHidden())
    await p.locator("#focusTools").click();
  await p.waitForFunction(
    () => document.querySelector("#focusPanel").hidden === false,
  );
}
// At phone width the reader toolbar is hidden, so the menus live under the
// reader-tools button.
async function openToolMenu(tool) {
  if (await p.locator("#popover").isHidden()) {
    await openReaderTools();
    await p.locator(tool).click();
  }
  await p.locator("#popover").waitFor({ state: "visible" });
}
async function closeMenu(tool = "#toolLayout") {
  await openReaderTools();
  await p.locator(tool).click();
  await p.locator("#popover").waitFor({ state: "hidden" });
}
async function backgroundChoice(id) {
  await openToolMenu("#toolTheme");
  await p.locator(`button[data-background="${id}"]`).click();
  await p.waitForFunction(
    (id) => document.documentElement.dataset.background === id,
    id,
  );
  await p
    .locator(`button[data-background="${id}"]`)
    .waitFor({ state: "visible" });
}
try {
  await p.goto(process.env.TEST_URL || "http://localhost:5173");
  await enterReader();
  await ready();
  const black = () =>
    p.locator("#stage").evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.equal(await black(), "rgb(0, 0, 0)");
  assert.equal(
    await p
      .locator("html")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(0, 0, 0)",
  );
  assert.equal(
    await p
      .locator(".stage-ambient")
      .evaluate((el) => getComputedStyle(el).opacity),
    "0",
  );
  const pdfBefore = await p
    .locator("#pdfCanvas")
    .evaluate((c) => c.toDataURL());
  for (const [id, color] of [
    ["charcoal", "rgb(20, 20, 20)"],
    ["forest", "rgb(23, 40, 39)"],
    ["parchment", "rgb(41, 35, 30)"],
  ]) {
    await backgroundChoice(id);
    assert.equal(await black(), color);
    assert.equal(
      await p.locator("#pdfCanvas").evaluate((c) => c.toDataURL()),
      pdfBefore,
    );
  }
  await p.reload();
  await ready();
  assert.equal(await black(), "rgb(41, 35, 30)");
  await backgroundChoice("black");
  await openToolMenu("#toolTheme");
  await p.locator('button[data-theme="sepia"]').click();
  assert.equal(await black(), "rgb(0, 0, 0)");
  await openToolMenu("#toolTheme");
  await p.locator('button[data-theme="original"]').click();
  console.log(
    "PASS pure-black default, independent paper colors, all four backgrounds, persisted preference",
  );
  // A press-and-hold now starts a text selection, so page turns are plain
  // swipes: touch down and drag before the 380 ms hold completes.
  await drag({ x: 0.75, y: 0.5 });
  await waitPage(2);
  await drag({ x: 0.25, y: 0.4, dx: -0.24 });
  await waitPage(3);
  await drag({ x: 0.4, y: 0.6, dx: 0.32 });
  await waitPage(2);
  console.log(
    "PASS touch swipes from the interior turn pages in both directions, independent of starting half",
  );
  await drag({ dx: 0, hold: 700 });
  await p.waitForTimeout(500);
  assert.equal(await num(), "2", "a long press selects text instead of turning");
  await drag({ dx: 0, dy: 0.2 });
  await p.waitForTimeout(400);
  assert.equal(await num(), "2");
  await drag({ dx: -0.05 });
  await p.waitForTimeout(1200);
  assert.equal(await num(), "2");
  await drag({ dx: -0.35, cancel: true });
  await p.waitForTimeout(1200);
  assert.equal(await num(), "2");
  console.log(
    "PASS stationary hold, vertical motion, tiny drag and canceled drag do not turn pages",
  );
  await drag({ x: 0.5, dx: -0.35, hold: 0, quick: true });
  await waitPage(3);
  console.log("PASS fast interior flick released while canvases are preparing");
  await openToolMenu("#toolLayout");
  await p.locator("#rtlToggle").check();
  await closeMenu("#toolLayout");
  await drag();
  await waitPage(2);
  await drag({ dx: 0.32 });
  await waitPage(3);
  await openToolMenu("#toolLayout");
  await p.locator("#rtlToggle").uncheck();
  await closeMenu("#toolLayout");
  console.log("PASS RTL reverses interior-swipe navigation");
  assert.equal(
    await p.locator("#zoomIn, #zoomOut, #zoomValue, #marker, #eraser, #hand").count(),
    0,
    "the zoom readout, marker, eraser and hand tools are gone",
  );
  const spread = await p.locator("#rightPage").boundingBox();
  const centre = {
    x: spread.x + spread.width * 0.5,
    y: spread.y + spread.height * 0.4,
  };
  const zoomNow = () =>
    p.locator("#bookSurface").evaluate((el) => el.style.getPropertyValue("--zoom"));
  await p.mouse.dblclick(centre.x, centre.y, { delay: 80 });
  await p.waitForTimeout(700);
  assert.equal(await zoomNow(), "2", "double-tap zooms in without zoom buttons");
  await drag();
  await p.waitForTimeout(400);
  assert.equal(await num(), "3", "a drag pans a zoomed page instead of turning it");
  assert.equal(
    await p
      .locator("#curlCanvas")
      .evaluate((el) => getComputedStyle(el).display),
    "none",
  );
  await p.mouse.dblclick(centre.x, centre.y, { delay: 80 });
  await p.waitForTimeout(700);
  assert.equal(await zoomNow(), "1", "double-tap returns the page to fit");
  console.log(
    "PASS double-tap zoom pans instead of turning pages, and the removed tools stay gone",
  );
  await p.screenshot({ path: "test-results/black-background-mobile.png" });
  await p.setViewportSize({ width: 1280, height: 1000 });
  await p.waitForFunction(
    () => document.querySelector("#bookSurface").classList.contains("spread"),
    null,
    { timeout: 20000 },
  );
  await p.waitForTimeout(500);
  await drag({ leaf: "#leftPage" });
  await waitPage(2);
  console.log("PASS dragging the left leaf of a desktop spread turns back a page");
  await p.reload();
  await ready();
  assert.equal(await black(), "rgb(0, 0, 0)");
  assert.deepEqual(errors, []);
  console.log("PASS preference restoration and no uncaught browser errors");
} finally {
  await browser.close();
}
