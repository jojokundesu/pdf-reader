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
const ready = () =>
  p.waitForFunction(
    () =>
      document.querySelectorAll(".thumb").length &&
      document.querySelector("#loading").hidden,
  );
const num = () => p.locator("#pageInput").inputValue();
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
  hold = 450,
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
async function backgroundChoice(id) {
  await p.locator("#theme").click();
  await p.locator(`button[data-background="${id}"]`).click();
  await p.waitForFunction(
    (id) => document.documentElement.dataset.background === id,
    id,
  );
  await p.locator("#theme").click();
}
try {
  await p.goto(process.env.TEST_URL || "http://localhost:5173");
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
  await p.locator("#theme").click();
  await p.locator('button[data-theme="sepia"]').click();
  assert.equal(await black(), "rgb(0, 0, 0)");
  await p.locator("#theme").click();
  await p.locator('button[data-theme="original"]').click();
  console.log(
    "PASS pure-black default, independent paper colors, all four backgrounds, persisted preference",
  );
  await drag({ x: 0.75, y: 0.5, hold: 800 });
  await waitPage(2);
  await drag({ x: 0.25, y: 0.4, dx: -0.24 });
  await waitPage(3);
  await drag({ x: 0.4, y: 0.6, dx: 0.32 });
  await waitPage(2);
  console.log(
    "PASS actual touch hold-and-drag from the interior in both directions, independent of starting half",
  );
  await drag({ dx: 0 });
  await p.waitForTimeout(500);
  assert.equal(await num(), "2");
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
  await p.locator("#layout").click();
  await p.locator("#rtlToggle").check();
  await p.locator("#layout").click();
  await drag();
  await waitPage(2);
  await drag({ dx: 0.32 });
  await waitPage(3);
  await p.locator("#layout").click();
  await p.locator("#rtlToggle").uncheck();
  await p.locator("#layout").click();
  console.log("PASS RTL reverses interior-swipe navigation");
  await p.locator("#zoomIn").click();
  await p.waitForTimeout(600);
  await drag();
  await p.waitForTimeout(300);
  assert.equal(await num(), "3");
  assert.equal(await p.locator("#zoomValue").textContent(), "125%");
  await p.locator("#zoomValue").click();
  await p.waitForTimeout(600);
  await p.locator("#marker").click();
  await drag({ hold: 0, dx: -0.25 });
  await p.waitForTimeout(500);
  assert.equal(await num(), "3");
  assert.equal(
    await p
      .locator("#curlCanvas")
      .evaluate((el) => getComputedStyle(el).display),
    "none",
  );
  await p.locator("#hand").click();
  console.log(
    "PASS drawing and zoomed panning remain separate from page turns",
  );
  await p.screenshot({ path: "test-results/black-background-mobile.png" });
  await p.setViewportSize({ width: 1280, height: 1000 });
  await p.waitForTimeout(700);
  await drag({ leaf: "#leftPage" });
  await waitPage(4);
  console.log("PASS interior drag on the left leaf of a desktop spread");
  await p.reload();
  await ready();
  assert.equal(await black(), "rgb(0, 0, 0)");
  assert.deepEqual(errors, []);
  console.log("PASS preference restoration and no uncaught browser errors");
} finally {
  await browser.close();
}
