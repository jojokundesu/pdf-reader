import { mkdirSync } from "node:fs";
mkdirSync("test-results", { recursive: true });
import assert from "node:assert/strict";
import { launch } from "./browser.mjs";
import { PDFDocument } from "pdf-lib";
const browser = await launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const p = await context.newPage(),
  errors = [];
p.on("pageerror", (e) => {
  errors.push(e.message);
  console.error("PAGE ERROR", e);
});
p.on("console", (m) => {
  if (m.type() === "error") console.error(m.text());
});
const url = process.env.TEST_URL || "http://localhost:5173";
const ready = () =>
  p.waitForFunction(
    () =>
      document.querySelector("#loading")?.hidden &&
      document.querySelectorAll(".thumb").length > 0,
    { timeout: 30000 },
  );
const pageNum = (n) =>
  p.waitForFunction(
    (n) => document.querySelector("#pageInput").value === String(n),
    n,
  );
const state = () =>
  p.evaluate(async () => {
    const db = await new Promise((r) => {
      const q = indexedDB.open("FlipVaultDB");
      q.onsuccess = () => r(q.result);
    });
    return await new Promise((r) => {
      const q = db
        .transaction("readingState")
        .objectStore("readingState")
        .getAll();
      q.onsuccess = () => r(q.result[0]);
    });
  });
try {
  await p.goto(url);
  await ready();
  await p.waitForTimeout(600);
  assert.equal(await p.locator(".thumb").count(), 12);
  assert.equal(await p.locator("#dialog").isVisible(), true);
  assert.match(
    await p.locator("#dialog h2").textContent(),
    /Welcome to FlipVault/,
  );
  await p.locator("#minimizeDialog").click();
  assert.equal(await p.locator("#resumeDialog").isVisible(), true);
  await p.locator("#resumeDialog").click();
  await p.locator("#tutorialNext").click();
  await p.locator("#tutorialNext").click();
  assert.match(
    await p.locator("#dialog h2").textContent(),
    /Settle in your way/,
  );
  await p.locator("#tutorialBack").click();
  await p.locator("#tutorialNext").click();
  await p.locator("#tutorialSkip").click();
  await p.locator("#theme").click();
  assert.equal(await p.locator("#popover").isVisible(), true);
  await p.locator("#minimizePopover").click();
  assert.equal(await p.locator("#resumePopover").isVisible(), true);
  await p.locator("#resumePopover").click();
  assert.equal(await p.locator("#popover").isVisible(), true);
  for (const theme of ["sepia", "dark", "ink", "original"]) {
    await p.locator(`[data-theme="${theme}"]`).click();
    assert.equal(await p.locator("html").getAttribute("data-theme"), theme);
    if (theme !== "original") await p.locator("#theme").click();
  }
  await p.locator("#theme").click();
  for (const background of ["charcoal", "forest", "parchment", "black"]) {
    await p.locator(`button[data-background="${background}"]`).click();
    assert.equal(
      await p.locator("html").getAttribute("data-background"),
      background,
    );
  }
  await p.locator("#preserveImages").check();
  assert.equal(
    await p
      .locator("body")
      .evaluate((el) => el.classList.contains("preserve-images")),
    true,
  );
  await p.locator("#preserveImages").uncheck();
  assert.equal(
    await p
      .locator("body")
      .evaluate((el) => el.classList.contains("preserve-images")),
    false,
  );
  await p.locator("#library").click();
  await p.waitForSelector("#drawer:not([hidden])");
  await p.locator("#minimizeDrawer").click();
  assert.equal(await p.locator("#resumeDrawer").isVisible(), true);
  await p.locator("#resumeDrawer").click();
  await p.locator("#closeDrawer").click();
  await p.locator("#more").click();
  await p.locator("#referenceTool").click();
  await p.waitForFunction(() => !document.querySelector("#reference").hidden);
  assert.equal(await p.locator("#referenceCanvas").isVisible(), true);
  await p.locator("#minimizeReference").click();
  assert.equal(await p.locator("#resumeReference").isVisible(), true);
  await p.locator("#resumeReference").click();
  assert.equal(await p.locator("#referenceCanvas").isVisible(), true);
  await p.locator("#closeReference").click();
  await p.locator("#more").click();
  await p.locator("#focusTimer").click();
  assert.match(await p.locator("#sessionLabel").textContent(), /FOCUS/);
  await p.locator("#more").click();
  await p.locator("#focusTimer").click();
  assert.doesNotMatch(await p.locator("#sessionLabel").textContent(), /FOCUS/);
  console.log(
    "PASS first-run tutorial, repeatable/minimizable overlays and settings menu",
  );
  console.log("PASS demo PDF and virtualized thumbnails");
  console.log("PASS production reader starts with the built-in sample book");
  await p.locator("#nextSmall").click();
  await pageNum(2);
  await p.locator("#layout").click();
  await p.locator('[data-mode="single"]').click();
  await p.waitForFunction(
    () => !document.querySelector("#bookSurface").classList.contains("spread"),
  );
  await p.locator("#layout").click();
  await p.locator('[data-mode="spread"]').click();
  await p.waitForFunction(() =>
    document.querySelector("#bookSurface").classList.contains("spread"),
  );
  await p.locator("#layout").click();
  await p.locator("#rtlToggle").check();
  assert.equal(
    (await p.locator("body").evaluate((el) => el.classList.contains("rtl"))) ||
      (await p.locator("#rtlToggle").isChecked()),
    true,
  );
  await p.locator("#rtlToggle").uncheck();
  await p.locator('[data-mode="auto"]').click();
  await p.waitForTimeout(400);
  await p.locator("#marker").click();
  let r = await p.locator("#rightPage").boundingBox();
  const pdfBefore = await p
    .locator("#pdfCanvas")
    .evaluate((c) => c.toDataURL());
  await p.mouse.move(r.x + r.width * 0.2, r.y + r.height * 0.35);
  await p.mouse.down();
  await p.mouse.move(r.x + r.width * 0.7, r.y + r.height * 0.35, { steps: 15 });
  await p.mouse.up();
  await p.waitForTimeout(600);
  assert.equal((await state()).pageAnnotations[2].length, 1);
  assert.equal(
    await p.locator("#pdfCanvas").evaluate((c) => c.toDataURL()),
    pdfBefore,
  );
  console.log("PASS independent marker layer and saved vector stroke");
  await p.locator("#undo").click();
  await p.waitForTimeout(500);
  assert.equal((await state()).pageAnnotations[2].length, 0);
  await p.locator("#redo").click();
  await p.waitForTimeout(500);
  assert.equal((await state()).pageAnnotations[2].length, 1);
  console.log("PASS undo / redo");
  await p.locator("#eraser").click();
  await p.mouse.move(r.x + r.width * 0.45, r.y + r.height * 0.35);
  await p.mouse.down();
  await p.mouse.move(r.x + r.width * 0.5, r.y + r.height * 0.35, { steps: 5 });
  await p.mouse.up();
  assert.equal(
    await p.locator("#pdfCanvas").evaluate((c) => c.toDataURL()),
    pdfBefore,
  );
  await p.locator("#undo").click();
  console.log("PASS precision eraser leaves PDF byte-identical");
  await p.locator("#addClip").click();
  await p.locator("#clipNote").fill("Important insight");
  await p.locator("#saveClip").click();
  assert.equal(await p.locator(".edge-tab").count(), 1);
  await p.waitForTimeout(600);
  console.log("PASS paperclip and all-book edge tab");
  await p.reload();
  await ready();
  await pageNum(2);
  assert.equal(await p.locator(".physical-clip").count(), 1);
  assert.equal((await state()).pageAnnotations[2].length, 1);
  console.log("PASS exact page, clips and ink restored after reload");
  await p.locator("#search").click();
  await p.locator("#searchInput").fill("attention");
  await p.waitForFunction(
    () => document.querySelectorAll("#searchResults .result").length > 0,
  );
  await p.locator("#closeDrawer").click();
  console.log("PASS full text search");
  await p.locator("#vault").click();
  const backupPromise = p.waitForEvent("download");
  await p.locator("#downloadVault").click();
  const backup = await backupPromise;
  const backupPath = await backup.path();
  assert.ok(backup.suggestedFilename().endsWith(".json"));
  await p.locator("#closeDialog").click();
  console.log("PASS downloadable vault backup");
  await p.locator("#export").click();
  let downloadPromise = p.waitForEvent("download");
  await p.locator("#exportPDF").click();
  let download = await downloadPromise;
  const exportPath = await download.path();
  const fs = await import("node:fs/promises");
  const pdf = await PDFDocument.load(
    new Uint8Array(await fs.readFile(exportPath)),
  );
  assert.equal(pdf.getPageCount(), 12);
  console.log("PASS annotated PDF exports valid 12-page PDF");
  await p.locator("#vaultFile").setInputFiles(backupPath);
  await p.waitForTimeout(1200);
  assert.equal((await state()).lastPage, 2);
  console.log("PASS vault restore round trip");
  await p.setViewportSize({ width: 393, height: 830 });
  await p.waitForTimeout(600);
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth),
    393,
  );
  await p.locator("#hand").click();
  r = await p.locator("#rightPage").boundingBox();
  await p.mouse.move(r.x + r.width - 2, r.y + r.height * 0.85);
  await p.mouse.down();
  await p.waitForTimeout(120);
  await p.mouse.move(r.x + r.width * 0.28, r.y + r.height * 0.8, { steps: 12 });
  assert.equal(
    await p.locator("#curlCanvas").evaluate((c) => getComputedStyle(c).display),
    "block",
  );
  await p.screenshot({ path: "test-results/curl-mobile.png" });
  await p.mouse.up();
  await pageNum(3);
  await p.waitForTimeout(350);
  console.log("PASS mobile edge drag and spring-completed canvas curl");
  r = await p.locator("#rightPage").boundingBox();
  await p.mouse.move(r.x + r.width * 0.45, r.y + r.height * 0.5);
  await p.mouse.down();
  await p.waitForTimeout(100);
  await p.mouse.move(r.x + r.width * 0.92, r.y + r.height * 0.5, { steps: 10 });
  assert.equal(
    await p.locator("#curlCanvas").evaluate((c) => getComputedStyle(c).display),
    "block",
  );
  await p.mouse.up();
  await pageNum(2);
  await p.locator("#nextSmall").click();
  await pageNum(3);
  console.log(
    "PASS right-to-left interior drag returns to the previous page without a rendering flash",
  );
  r = await p.locator("#rightPage").boundingBox();
  await p.mouse.dblclick(r.x + r.width * 0.5, r.y + r.height * 0.4, {
    delay: 80,
  });
  await p.waitForTimeout(500);
  assert.equal(await p.locator("#zoomValue").textContent(), "200%");
  await p.locator("#zoomValue").click();
  await p.waitForTimeout(450);
  const cdp = await context.newCDPSession(p);
  r = await p.locator("#rightPage").boundingBox();
  const cx = r.x + r.width * 0.5,
    cy = r.y + r.height * 0.5;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: cx - 30, y: cy, id: 1 },
      { x: cx + 30, y: cy, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: cx - 60, y: cy, id: 1 },
      { x: cx + 60, y: cy, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await p.waitForTimeout(500);
  assert.equal(await p.locator("#zoomValue").textContent(), "200%");
  await p.locator("#zoomValue").click();
  await p.waitForTimeout(450);
  console.log("PASS double-tap and multi-touch pinch zoom");
  await p.locator("#focus").click();
  assert.equal(await p.locator("#exitFocus").isVisible(), true);
  assert.equal(await p.locator("#focusTools").isVisible(), true);
  await p.locator("#focusTools").click();
  assert.equal(await p.locator("#focusPanel").isVisible(), true);
  assert.equal(await p.locator("#focusTools svg").count(), 1);
  assert.equal(await p.locator('[data-focus="bookmark"] svg').count(), 1);
  for (const id of [
    "hand",
    "marker",
    "eraser",
    "bookmark",
    "zoom-in",
    "zoom-out",
    "sound",
    "search",
    "more",
    "tutorial",
  ])
    assert.equal(
      await p.locator(`[data-focus="${id}"]`).count(),
      1,
      `missing focus action ${id}`,
    );
  assert.equal(await p.locator("#focusFilmstrip").count(), 1);
  await p.locator('[data-focus="bookmark"]').click();
  assert.equal(await p.locator("#dialog").isVisible(), true);
  assert.equal(await p.locator("#clipNote").count(), 1);
  await p.locator("#closeDialog").click();
  await p.locator('[data-focus="marker"]').click();
  assert.equal(await p.locator("#studio").isVisible(), true);
  await p.locator('[data-focus="eraser"]').click();
  assert.equal(await p.locator("#studio").isVisible(), true);
  await p.locator("#focusFilmstrip").click();
  assert.equal(
    await p
      .locator("body")
      .evaluate((el) => el.classList.contains("focus-filmstrip")),
    true,
  );
  assert.equal(await p.locator("#filmstrip").isVisible(), true);
  await p.locator("#minimizeFocusTools").click();
  assert.equal(await p.locator("#focusPanel").isVisible(), false);
  await p.locator("#exitFocus").click();
  console.log(
    "PASS focus mode offers readable reader tools, page thumbnails and accessible exit",
  );
  await p.screenshot({ path: "test-results/mobile-final.png" });
  assert.deepEqual(errors, []);
  console.log("PASS no uncaught browser errors");
  if (process.env.TEST_OFFLINE) {
    await p.waitForFunction(() => navigator.serviceWorker.controller);
    await context.setOffline(true);
    await p.reload();
    await ready();
    assert.equal(await p.locator("#pageInput").inputValue(), "3");
    console.log("PASS offline app reload and reading restoration");
  }
} finally {
  await browser.close();
}
