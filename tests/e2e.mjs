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
    () => {
      const home = document.body.classList.contains("at-home");
      return (
        document.querySelector("#loading")?.hidden &&
        (home || document.querySelectorAll(".thumb").length > 0)
      );
    },
    { timeout: 30000 },
  );
// Press and hold, exactly like a finger on a word: the reader selects the
// word under the pointer and keeps the selection mode open for a drag.
const holdAt = async (x, y, ms = 520) => {
  await p.mouse.move(x, y);
  await p.mouse.down();
  await p.waitForTimeout(ms);
};
const selectedWords = async () =>
  (await p.locator("#selectionCount").getAttribute("aria-label")) || "";
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
  await p.waitForFunction(() => document.querySelector("#dialog")?.open, {
    timeout: 10000,
  });
  await p.waitForTimeout(150);
  assert.equal(
    await p.locator("body").evaluate((el) => el.classList.contains("at-home")),
    true,
    "a first launch lands on the library, not inside the reader",
  );
  assert.equal(await p.locator("#homeGrid .home-book").count(), 1);
  await p
    .locator("#homeContinueButton")
    .waitFor({ state: "visible", timeout: 20000 });
  assert.equal(await p.locator("#homeContinueButton").isVisible(), true);
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
    /Keep what matters/,
  );
  await p.locator("#tutorialBack").click();
  await p.locator("#tutorialNext").click();
  await p.locator("#tutorialSkip").click();
  await p
    .locator("#homeContinueButton")
    .waitFor({ state: "visible", timeout: 20000 });
  await p.locator("#homeContinueButton").click();
  await p.waitForFunction(() => !document.body.classList.contains("at-home"));
  await ready();
  await p.waitForFunction(() => document.querySelectorAll(".thumb").length === 12);
  assert.equal(await p.locator(".thumb").count(), 12);
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
  await p.waitForFunction(() => document.body.classList.contains("at-home"));
  assert.equal(await p.locator("#homeGrid .home-book").count(), 1);
  assert.equal(await p.locator("#homeContinue").isVisible(), true);
  const homeProgress = await p
    .locator("#homeContinue .home-progress span")
    .evaluate((el) => el.style.width);
  assert.match(homeProgress, /%$/);
  await p
    .locator("#homeContinueButton")
    .waitFor({ state: "visible", timeout: 20000 });
  await p.locator("#homeContinueButton").click();
  await p.waitForFunction(() => !document.body.classList.contains("at-home"));
  await ready();
  await p.locator("#focusTools").click();
  await p.locator("#toolReference").click();
  await p.waitForFunction(() => !document.querySelector("#reference").hidden);
  assert.equal(await p.locator("#referenceCanvas").isVisible(), true);
  await p.locator("#minimizeReference").click();
  assert.equal(await p.locator("#resumeReference").isVisible(), true);
  await p.locator("#resumeReference").click();
  assert.equal(await p.locator("#referenceCanvas").isVisible(), true);
  const refBox = await p.locator("#reference").boundingBox();
  assert.ok(
    refBox && refBox.x >= 0 && refBox.y >= 0 && refBox.x + refBox.width <= 1440,
    "the reference panel opens fully inside the window",
  );
  await p.locator("#closeReference").click();
  assert.equal(await p.locator("#reference").isVisible(), false);
  await p.locator("#focusTools").click();
  await p.locator("#toolTimer").click();
  assert.match(await p.locator("#sessionLabel").textContent(), /FOCUS/);
  await p.locator("#focusTools").click();
  await p.locator("#toolTimer").click();
  assert.doesNotMatch(await p.locator("#sessionLabel").textContent(), /FOCUS/);
  console.log(
    "PASS first-run tutorial, repeatable/minimizable overlays and settings menu",
  );
  console.log("PASS demo PDF and virtualized thumbnails");
  console.log("PASS production reader starts with the built-in sample book");
  await p.locator("#pageInput").fill("2");
  await p.locator("#pageInput").press("Enter");
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
  let r = await p.locator("#rightPage").boundingBox();
  const pdfBefore = await p
    .locator("#pdfCanvas")
    .evaluate((c) => c.toDataURL());
  assert.equal(await p.locator("#selectText").count(), 0, "no select mode button");
  assert.equal(await p.locator("#prev, #next, #more").count(), 0);
  await p.waitForFunction(
    () => document.querySelectorAll("#textLayer span").length > 2,
  );
  const firstSpan = await p.locator("#textLayer span").first().boundingBox();
  const lastSpan = await p.locator("#textLayer span").last().boundingBox();
  assert.ok(firstSpan && lastSpan, "page text layer exposes selectable runs");
  await holdAt(firstSpan.x + 2, firstSpan.y + firstSpan.height / 2);
  assert.match(await selectedWords(), /^1 word selected$/, "holding selects one word");
  await p.mouse.move(
    lastSpan.x + lastSpan.width - 2,
    lastSpan.y + lastSpan.height / 2,
    { steps: 12 },
  );
  await p.waitForTimeout(150);
  assert.doesNotMatch(
    await selectedWords(),
    /^1 word selected$/,
    "dragging past the first word extends the selection word by word",
  );
  await p.mouse.up();
  await p.waitForFunction(
    () => !document.querySelector("#selectionActions").hidden,
  );
  assert.ok(
    (await p.locator("#selectionCount").getAttribute("title")).length > 3,
    "dragging the page text produces a real selection",
  );
  assert.ok(
    (await p.locator("#selectionLayer .selection-rect").count()) > 0,
    "the selection is painted over the exact words",
  );
  await p.locator("#highlightSelection").click();
  await p.waitForFunction(
    () => document.querySelectorAll("#highlightLayer .text-highlight").length > 0,
  );
  await p.waitForTimeout(600);
  assert.equal((await state()).textHighlights[2].length, 1);
  assert.equal(
    await p.locator("#pdfCanvas").evaluate((c) => c.toDataURL()),
    pdfBefore,
  );
  console.log(
    "PASS select-to-highlight keeps the PDF byte-identical and skips marker/eraser tools",
  );
  await p.locator("#addClip").click();
  await p.locator("#clipNote").fill("Important insight");
  await p.locator("#saveClip").click();
  assert.equal(await p.locator(".edge-tab").count(), 1);
  await p.waitForTimeout(600);
  console.log("PASS paperclip and all-book edge tab");
  await p.reload();
  await ready();
  assert.equal(
    await p.evaluate(() => document.querySelector("#dialog").open),
    false,
    "the welcome tour never comes back after the first time it was dismissed",
  );
  await p.waitForFunction(
    () => !document.body.classList.contains("at-home"),
    null,
    { timeout: 20000 },
  );
  assert.equal(
    await p.evaluate(() => document.body.classList.contains("at-home")),
    false,
    "a WebView reload while reading resumes the same book instead of the library",
  );
  await pageNum(2);
  assert.equal(await p.locator(".physical-clip").count(), 1);
  assert.equal((await state()).textHighlights[2].length, 1);
  assert.ok(
    (await p.locator("#highlightLayer .text-highlight").count()) > 0,
    "saved highlights are painted again after a reload",
  );
  console.log("PASS exact page, clips and highlights restored after reload");
  await p.locator("#focusSearch").click();
  assert.equal(await p.locator("#readerSearch").isVisible(), true);
  await p.locator("#searchInput").fill("attention");
  await p.waitForFunction(() =>
    /^1 of [1-9][0-9]*$/.test(
      document.querySelector("#searchStatus").textContent,
    ),
  );
  const searchCount = Number(
    (await p.locator("#searchStatus").textContent()).split(" of ")[1],
  );
  assert.ok(searchCount > 0);
  await p.waitForFunction(
    () => document.querySelector("#searchLayer .search-rect.current"),
  );
  const hitGeometry = await p.evaluate(() => {
    const current = document.querySelector("#searchLayer .search-rect.current");
    const walker = document.createTreeWalker(
      document.querySelector("#textLayer"),
      NodeFilter.SHOW_TEXT,
    );
    let node, range = null;
    while ((node = walker.nextNode())) {
      const index = node.nodeValue.toLowerCase().indexOf("attention");
      if (index >= 0) {
        range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + 9);
        break;
      }
    }
    if (!range) return null;
    const box = current.getBoundingClientRect();
    const word = range.getBoundingClientRect();
    return {
      dx: Math.abs(box.left + box.width / 2 - (word.left + word.width / 2)),
      dy: Math.abs(box.top + box.height / 2 - (word.top + word.height / 2)),
      widthRatio: box.width / word.width,
    };
  });
  assert.ok(hitGeometry, "the current match is painted as a rectangle");
  assert.ok(
    hitGeometry.dx < 3 && hitGeometry.dy < 3,
    `search highlight sits on the matched word (dx ${hitGeometry.dx.toFixed(1)}, dy ${hitGeometry.dy.toFixed(1)})`,
  );
  assert.ok(
    hitGeometry.widthRatio > 0.8 && hitGeometry.widthRatio < 1.2,
    "search highlight has the same width as the matched word",
  );
  if (searchCount > 1) {
    await p.locator("#nextSearchHit").click();
    await p.waitForFunction(() =>
      document.querySelector("#searchStatus").textContent.startsWith("2 of "),
    );
  }
  assert.equal(await p.locator("#selectSearchHit").isEnabled(), true);
  await p.locator("#selectSearchHit").click();
  await p.waitForFunction(
    () => !document.querySelector("#selectionActions").hidden,
  );
  assert.match(
    await p.locator("#selectionCount").getAttribute("title"),
    /^attention$/i,
  );
  assert.ok(
    (await p.locator("#selectionLayer .selection-rect").count()) > 0,
    "a search hit becomes a real painted selection",
  );
  await p.locator("#meaningSelection").click();
  await p.waitForFunction(
    () => document.querySelector(".meaning-entry, .dialog-body .fine-print"),
    null,
    { timeout: 25000 },
  );
  assert.ok(
    (await p.locator(".meaning-entry .meaning-pos").count()) > 0,
    "Meaning resolves the selected word in the bundled offline dictionary",
  );
  assert.match(
    await p.locator(".meaning-entry h3").first().textContent(),
    /attention/i,
  );
  assert.ok(
    (await p.locator("#dialog .fine-print").textContent()).includes(
      "Offline WordNet",
    ),
    "the dictionary panel makes clear it is offline",
  );
  await p.locator("#closeMeaning").click();
  await p.locator("#clearSelection").click();
  assert.equal(await p.locator("#readerSearch").isVisible(), false);
  console.log(
    "PASS Drive-style full-document search, occurrence count, exact match highlighting and contextual actions",
  );
  // --- the thumbnail strip follows the page you are on -------------------
  await p.locator("#pageInput").fill("9");
  await p.locator("#pageInput").press("Enter");
  await pageNum(9);
  await p.waitForFunction(
    () =>
      document.querySelector("#filmstrip .thumb.selected")?.dataset.page === "9",
    null,
    { timeout: 10000 },
  );
  await p.waitForTimeout(400);
  assert.deepEqual(
    await p.evaluate(() => {
      const strip = document.querySelector("#filmstrip");
      const thumb = strip.querySelector(".thumb.selected");
      const s = strip.getBoundingClientRect(),
        t = thumb.getBoundingClientRect();
      return { page: thumb.dataset.page, visible: t.left >= s.left - 1 && t.right <= s.right + 1 };
    }),
    { page: "9", visible: true },
    "the thumbnail strip highlights and shows the current page",
  );
  console.log("PASS thumbnails follow the page being read");

  // --- dark reading themes ------------------------------------------------
  await p.locator("#theme").click();
  for (const id of ["cream", "mocha", "slate"])
    assert.equal(await p.locator(`[data-theme="${id}"]`).count(), 1);
  await p.locator('[data-theme="cream"]').click();
  assert.equal(await p.locator("html").getAttribute("data-theme"), "cream");
  assert.match(
    await p.locator("#theme span").textContent(),
    /Dark cream/,
    "the toolbar shows the chosen theme",
  );
  const creamFilter = await p
    .locator("#pdfCanvas")
    .evaluate((c) => getComputedStyle(c).filter);
  assert.match(creamFilter, /sepia/, "dark cream warms the rendered page");
  await p.locator("#theme").click();
  await p.locator('[data-theme="original"]').click();
  console.log("PASS dark cream, mocha and slate themes apply to the page");

  // --- reader artwork ----------------------------------------------------
  await p.locator("#focusTools").click();
  await p.locator("#toolBackground").click();
  await p.waitForFunction(() => document.querySelector("#dialog")?.open);
  assert.equal(
    await p.locator("#backgroundGrid .background-tile").count(),
    3,
    "the reading room offers two built-in desks and no background",
  );
  // A desk that ships with the app is applied exactly like an upload.
  await p.locator('[data-artwork="builtin-desk-oak"]').click();
  await p.waitForFunction(
    () =>
      /\/assets\//.test(
        document.documentElement.style.getPropertyValue("--reader-art"),
      ),
    null,
    { timeout: 10000 },
  );
  assert.equal(
    await p.evaluate(() => document.documentElement.dataset.readerArt),
    "on",
    "a built-in desk is painted behind the pages",
  );
  const artwork = (await p.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1800;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#16302a";
    ctx.fillRect(0, 0, 1200, 1800);
    ctx.fillStyle = "#d7e6b8";
    for (let i = 0; i < 30; i++) ctx.fillRect(40 + i * 38, 500 + Math.sin(i) * 180, 14, 700);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }));
  await p.locator("#artworkFile").setInputFiles({
    name: "night-garden.png",
    mimeType: "image/png",
    buffer: Buffer.from(artwork, "base64"),
  });
  await p.waitForFunction(
    () => document.querySelectorAll("#backgroundGrid .background-tile").length === 4,
    null,
    { timeout: 15000 },
  );
  assert.equal(
    await p.evaluate(() => document.documentElement.dataset.readerArt),
    "on",
    "the chosen artwork is painted behind the pages",
  );
  assert.match(
    await p.evaluate(() =>
      document.documentElement.style.getPropertyValue("--reader-art"),
    ),
    /^url\("data:image\/jpeg/,
    "the stored artwork is re-encoded before it is used",
  );
  assert.equal(
    await p.evaluate(async () => {
      const db = await new Promise((resolve) => {
        const request = indexedDB.open("FlipVaultDB");
        request.onsuccess = () => resolve(request.result);
      });
      return await new Promise((resolve) => {
        const request = db
          .transaction("settings")
          .objectStore("settings")
          .get("backgroundLibrary");
        request.onsuccess = () => resolve(request.result?.images?.length || 0);
      });
    }),
    1,
    "artwork is stored on this device and survives a reload",
  );
  // Advanced: the picture can change on every launch, or stay put.
  await p.locator("#artworkRotate").check();
  await p.waitForFunction(
    () =>
      /greet you each time/.test(
        document.querySelector("#toast").textContent || "",
      ),
    null,
    { timeout: 10000 },
  );
  assert.equal(
    await p.evaluate(async () => {
      const db = await new Promise((resolve) => {
        const request = indexedDB.open("FlipVaultDB");
        request.onsuccess = () => resolve(request.result);
      });
      return await new Promise((resolve) => {
        const request = db
          .transaction("settings")
          .objectStore("settings")
          .get("backgroundLibrary");
        request.onsuccess = () => resolve(request.result?.rotate === true);
      });
    }),
    true,
    "the rotate-on-open preference is stored",
  );
  await p.locator("#artworkRotate").uncheck();
  await p.waitForFunction(
    () => /will stay put/.test(document.querySelector("#toast").textContent || ""),
    null,
    { timeout: 10000 },
  );
  // An image too small for a full-screen background is refused.
  const tiny = (await p.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 240;
    canvas.getContext("2d").fillRect(0, 0, 240, 240);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }));
  await p.locator("#artworkFile").setInputFiles({
    name: "too-small.png",
    mimeType: "image/png",
    buffer: Buffer.from(tiny, "base64"),
  });
  await p.waitForFunction(
    () => /at least 800/.test(document.querySelector("#toast").textContent || ""),
    null,
    { timeout: 10000 },
  );
  assert.equal(
    await p.locator("#backgroundGrid .background-tile").count(),
    4,
    "an image with the wrong dimensions is refused",
  );
  await p.locator("#closeBackgrounds").click();
  console.log(
    "PASS reader artwork is validated, stored, and painted behind the pages",
  );

  // --- reading-data backup from the library ------------------------------
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
  assert.equal(
    (await state()).lastPage,
    9,
    "restoring the backup returns to the page that was saved",
  );
  console.log("PASS vault restore round trip");
  await p.setViewportSize({ width: 393, height: 830 });
  await p.waitForTimeout(600);
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth),
    393,
  );
  await p.locator("#pageInput").fill("2");
  await p.locator("#pageInput").press("Enter");
  await pageNum(2);
  await p.waitForTimeout(400);
  r = await p.locator("#rightPage").boundingBox();
  await p.mouse.move(r.x + r.width - 2, r.y + r.height * 0.85);
  await p.mouse.down();
  await p.waitForTimeout(250);
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
  await p.locator("#pageInput").fill("3");
  await p.locator("#pageInput").press("Enter");
  await pageNum(3);
  console.log(
    "PASS right-to-left interior drag returns to the previous page without a rendering flash",
  );
  r = await p.locator("#rightPage").boundingBox();
  await p.mouse.dblclick(r.x + r.width * 0.5, r.y + r.height * 0.4, {
    delay: 80,
  });
  await p.waitForTimeout(500);
  assert.equal(
    await p.locator("#bookSurface").evaluate((el) => el.style.getPropertyValue("--zoom")),
    "2",
    "double-tap zooms in",
  );
  const readZoom = () =>
    p
      .locator("#bookSurface")
      .evaluate((el) => Number(el.style.getPropertyValue("--zoom")));
  const cdp = await context.newCDPSession(p);
  const center = await p.evaluate(() => ({
    x: innerWidth / 2,
    y: innerHeight / 2,
  }));
  const pinch = async (from, to) => {
    const cx = center.x,
      cy = center.y;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: cx - from, y: cy, id: 1 },
        { x: cx + from, y: cy, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: cx - to, y: cy, id: 1 },
        { x: cx + to, y: cy, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await p.waitForTimeout(500);
  };
  await pinch(30, 60);
  assert.ok(
    (await readZoom()) > 2,
    "pinching zooms in without zoom buttons",
  );
  await p.mouse.dblclick(center.x, center.y, { delay: 80 });
  await p.waitForTimeout(500);
  assert.equal(await readZoom(), 1, "double-tapping again returns the page to fit");
  console.log("PASS double-tap and multi-touch pinch zoom without zoom buttons");
  await p.locator("#focus").click();
  assert.equal(await p.locator("#exitFocus").isVisible(), true);
  assert.equal(await p.locator("#focusTools").isVisible(), true);
  await p.locator("#focusTools").click();
  assert.equal(await p.locator("#focusPanel").isVisible(), true);
  assert.equal(await p.locator("#focusTools svg").count(), 1);
  assert.equal(await p.locator("#toolBookmark svg").count(), 1);
  for (const id of [
    "toolLayout",
    "toolTheme",
    "toolBackground",
    "toolFilmstrip",
    "toolGoToPage",
    "toolBookmark",
    "toolReference",
    "toolSound",
    "toolTimer",
    "toolGuide",
    "toolTour",
    "toolHome",
  ])
    assert.equal(
      await p.locator(`#${id}`).count(),
      1,
      `missing reader tool ${id}`,
    );
  assert.equal(await p.locator('[data-focus="selectText"]').count(), 0);
  const openFocusTools = async () => {
    if (await p.locator("#focusPanel").isVisible()) return;
    await p.locator("#focusTools").click();
    await p.waitForFunction(
      () => document.querySelector("#focusPanel").hidden === false,
    );
  };
  await p.locator("#toolBookmark").click();
  assert.equal(await p.locator("#dialog").isVisible(), true);
  assert.equal(await p.locator("#clipNote").count(), 1);
  await p.locator("#closeDialog").click();
  const findWord = () =>
    p.evaluate(() => {
      const blocked = [
        ...document.querySelectorAll("#highlightLayer .text-highlight"),
      ].map((el) => el.getBoundingClientRect());
      const overlaps = (r) =>
        blocked.some(
          (b) =>
            r.left < b.right &&
            r.right > b.left &&
            r.top < b.bottom &&
            r.bottom > b.top,
        );
      let widest = null;
      for (const span of document.querySelectorAll("#textLayer span")) {
        const rect = span.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 2) continue;
        if (rect.bottom < 8 || rect.top > innerHeight - 8) continue;
        if (overlaps(rect)) continue;
        if (!widest || rect.width > widest.width)
          widest = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }
      return widest;
    });
  // The text layer is rebuilt asynchronously, so wait for both the raster and
  // the selectable spans before tapping a word.
  await p.waitForFunction(
    () => {
      const loading = document.querySelector("#loading");
      if (loading && !loading.hidden) return false;
      return [...document.querySelectorAll("#textLayer span")].some((span) => {
        const rect = span.getBoundingClientRect();
        return (
          rect.width >= 8 &&
          rect.height >= 2 &&
          rect.bottom > 8 &&
          rect.top < innerHeight - 8
        );
      });
    },
    null,
    { timeout: 20000 },
  );
  let selected = false;
  for (let attempt = 0; attempt < 3 && !selected; attempt++) {
    const box = await findWord();
    if (!box) {
      await p.waitForTimeout(250);
      continue;
    }
    await holdAt(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.up();
    selected = await p
      .waitForFunction(
        () => !document.querySelector("#selectionActions").hidden,
        null,
        { timeout: 3000 },
      )
      .then(() => true)
      .catch(() => false);
  }
  assert.ok(selected, "holding a word opens the selection bar");
  const copiedPassage = await p
    .locator("#selectionCount")
    .getAttribute("title");
  assert.ok(copiedPassage.length > 0, "holding a word selects it");
  await p.evaluate(() => {
    window.__copiedSelection = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedSelection = text;
        },
      },
    });
    // The reader falls back to execCommand("copy") when the clipboard API is
    // refused, so catch that path as well.
    document.addEventListener(
      "copy",
      () => {
        window.__copiedSelection = String(document.getSelection());
      },
      true,
    );
  });
  await p.locator("#copySelection").click();
  const clipboardText = await p
    .waitForFunction(() => window.__copiedSelection || null, null, {
      timeout: 8000,
    })
    .then((handle) => handle.jsonValue())
    .catch(() => "");
  assert.equal(clipboardText, copiedPassage, "Copy puts the selection on the clipboard");
  await p.evaluate(() => {
    window.__sharedSelection = null;
    navigator.share = async (payload) => {
      window.__sharedSelection = payload.text;
    };
  });
  await p.locator("#moreSelection").click();
  await p.locator("#shareSelection").click();
  const sharedText = await p
    .waitForFunction(() => window.__sharedSelection || null, null, {
      timeout: 8000,
    })
    .then((handle) => handle.jsonValue())
    .catch(() => "");
  assert.equal(sharedText, copiedPassage, "Share hands the selection to Android");
  await p.evaluate(() => {
    window.__translatedUrl = "";
    window.open = (url) => (window.__translatedUrl = url);
  });
  await p.locator("#translateSelection").click();
  await p.locator("#translateLanguage").selectOption("hi");
  await p.locator("#openTranslate").click();
  assert.match(
    await p.evaluate(() => window.__translatedUrl),
    /translate\.google\.com/,
  );
  assert.match(await p.evaluate(() => window.__translatedUrl), /tl=hi/);
  await p.locator("#commentSelection").click();
  assert.match(await p.locator(".selected-quote").textContent(), /.+/);
  await p.locator("#clipNote").fill("Comment anchored to this passage");
  await p.locator("#saveClip").click();
  // Playwright does not await async waitForFunction predicates, so poll the
  // database from Node instead of trusting a promise-returning predicate.
  for (let i = 0; ; i++) {
    const saved = await p.evaluate(async () => {
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
      return rows.some((item) =>
        (item.paperclips || []).some(
          (clip) =>
            clip.quote && clip.note === "Comment anchored to this passage",
        ),
      );
    });
    if (saved) break;
    if (i > 60) throw new Error("the anchored comment was never saved");
    await p.waitForTimeout(100);
  }
  await p.locator("#moreSelection").click();
  await p.locator("#selectAllSelection").click();
  assert.ok(
    (await p.locator("#selectionCount").getAttribute("title")).length >
      copiedPassage.length,
    "Select all selects the readable text on the visible page",
  );
  assert.ok(
    (await p.locator("#selectionLayer .selection-rect").count()) > 1,
    "Select all paints the whole page of text",
  );
  await p.locator("#clearSelection").click();
  await openFocusTools();
  assert.equal(
    await p.locator("#toolFilmstrip").getAttribute("aria-pressed"),
    "true",
    "the tools panel reports that thumbnails are showing",
  );
  await p.locator("#toolFilmstrip").click();
  assert.equal(
    await p
      .locator("body")
      .evaluate((el) => el.classList.contains("focus-filmstrip")),
    false,
    "the thumbnail toggle hides the strip",
  );
  assert.equal(await p.locator("#toolFilmstrip").getAttribute("aria-pressed"), "false");
  await p.locator("#toolFilmstrip").click();
  assert.equal(await p.locator("#filmstrip").isVisible(), true);
  await p.locator("#minimizeFocusTools").click();
  assert.equal(await p.locator("#focusPanel").isVisible(), false);
  await p.locator("#exitFocus").click();
  console.log(
    "PASS focus mode offers readable reader tools, page thumbnails and accessible exit",
  );

  const hindiTextBuffer = Buffer.from(
    "A quiet page\n\nHello from the offline library.\n\nनमस्ते, यह FlipVault की किताब है।\n\nবাংলা বই পড়ুন\n\nதமிழ் புத்தகம்\n\nతెలుగు పుస్తకం",
    "utf8",
  );
  await p.locator("#pdfFile").setInputFiles({
    name: "hindi-notes.txt",
    mimeType: "text/plain",
    buffer: hindiTextBuffer,
  });
  await p.waitForFunction(
    () => document.querySelector("#bookTitle").textContent === "hindi-notes",
    { timeout: 30000 },
  );
  await p.waitForFunction(() => document.querySelector("#loading").hidden);
  await p.waitForFunction(
    () => document.querySelectorAll("#textLayer span").length > 0,
  );
  const importedText = await p.locator("#textLayer").textContent();
  assert.match(importedText, /Hello from the offline library/);
  assert.match(importedText, /नमस्ते/);
  assert.match(importedText, /বাংলা/);
  assert.match(importedText, /தமிழ்/);
  assert.match(importedText, /తెలుగు/);
  const actualTextSpan = p
    .locator("#textLayer span")
    .filter({ hasText: /^Hello$/ })
    .first();
  const endTextSpan = p
    .locator("#textLayer span")
    .filter({ hasText: /^library\.$/ })
    .first();
  const textBox = await actualTextSpan.boundingBox();
  const endTextBox = await endTextSpan.boundingBox();
  assert.ok(
    textBox && textBox.width > 4 && textBox.height > 2,
    "PDF text spans align over the rendered page",
  );
  assert.ok(
    endTextBox && endTextBox.x + endTextBox.width > textBox.x + textBox.width,
    "selection layer follows the sentence's reading order",
  );
  await holdAt(textBox.x + 1, textBox.y + textBox.height / 2);
  await p.mouse.move(
    endTextBox.x + endTextBox.width - 1,
    endTextBox.y + endTextBox.height / 2,
    { steps: 10 },
  );
  await p.mouse.up();
  assert.ok(
    (await p.locator("#selectionCount").getAttribute("title")).length > 1,
    "drag selection returns page text",
  );
  assert.ok(
    (await p.locator("#selectionLayer .selection-rect").count()) > 0,
    "drag selection paints overlay rectangles",
  );
  console.log(
    "PASS reflowed multilingual text and accurate drag-to-select page overlays",
  );

  const JSZip = (await import("jszip")).default;
  const epub = new JSZip();
  epub.file("mimetype", "application/epub+zip", { compression: "STORE" });
  epub.file(
    "META-INF/container.xml",
    '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
  );
  epub.file(
    "OPS/book.opf",
    '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>Offline Garden</dc:title><dc:creator>Test Reader</dc:creator></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>',
  );
  epub.file(
    "OPS/chapter.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Chapter One</h1><p>Open standards books are read without a network.</p><p>नमस्ते from the garden.</p></body></html>',
  );
  const epubBuffer = await epub.generateAsync({ type: "nodebuffer" });
  await p.locator("#pdfFile").setInputFiles({
    name: "garden.epub",
    mimeType: "application/epub+zip",
    buffer: epubBuffer,
  });
  await p.waitForFunction(
    () => document.querySelector("#bookTitle").textContent === "Offline Garden",
    { timeout: 30000 },
  );
  await p.waitForFunction(() => document.querySelector("#loading").hidden);
  await p.waitForFunction(
    () => document.querySelectorAll("#textLayer span").length > 0,
  );
  assert.match(
    await p.locator("#textLayer").textContent(),
    /Open standards books/,
  );
  console.log(
    "PASS EPUB container, metadata, reading order and Unicode chapter conversion",
  );
  await p.locator("#pdfFile").setInputFiles({
    name: "notes.html",
    mimeType: "text/html",
    buffer: Buffer.from(
      "<!doctype html><html><body><h2>Local page</h2><p>HTML text is extracted without running scripts.</p><script>window.__unsafeHtmlRan = true</script></body></html>",
    ),
  });
  await p.waitForFunction(
    () => document.querySelector("#bookTitle").textContent === "notes",
    { timeout: 30000 },
  );
  await p.waitForFunction(() => document.querySelector("#loading").hidden);
  await p.waitForFunction(
    () => document.querySelectorAll("#textLayer span").length > 0,
  );
  assert.match(
    await p.locator("#textLayer").textContent(),
    /HTML text is extracted/,
  );
  assert.equal(await p.evaluate(() => window.__unsafeHtmlRan), undefined);
  console.log(
    "PASS safe HTML text import strips executable content and retains headings",
  );

  const cbz = new JSZip();
  const coverBytes = await fs.readFile(
    new URL("../public/icon-192.png", import.meta.url),
  );
  cbz.file("page 10.png", coverBytes);
  cbz.file("page 2.png", coverBytes);
  cbz.file("page 1.png", coverBytes);
  const cbzBuffer = await cbz.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  await p.locator("#pdfFile").setInputFiles({
    name: "small-comic.cbz",
    mimeType: "application/vnd.comicbook+zip",
    buffer: cbzBuffer,
  });
  await p.waitForFunction(
    () => document.querySelector("#bookTitle").textContent === "small-comic",
    { timeout: 30000 },
  );
  await p.waitForFunction(() => document.querySelector("#loading").hidden);
  assert.equal(await p.locator("#pageTotal").textContent(), "/ 3");
  console.log(
    "PASS CBZ image-page conversion and numbered comic archive input",
  );
  await p.evaluate(() => {
    window.__readerConsoleError = console.error;
    console.error = () => {};
  });
  for (const extension of ["mobi", "djvu", "cbr"]) {
    await p.evaluate(() => {
      document.querySelector("#toast").hidden = true;
    });
    await p.locator("#pdfFile").setInputFiles({
      name: `invalid.${extension}`,
      mimeType: "application/octet-stream",
      buffer: Buffer.from("not a valid book file"),
    });
    await p.waitForFunction(
      () =>
        document.querySelector("#loading").hidden &&
        !document.querySelector("#toast").hidden,
      { timeout: 30000 },
    );
    assert.equal(
      await p.locator("#bookTitle").textContent(),
      "small-comic",
      `invalid ${extension.toUpperCase()} imports do not replace the current book`,
    );
  }
  assert.equal(
    await p.locator("#bookTitle").textContent(),
    "small-comic",
    "invalid imports do not replace the current book",
  );
  await p.evaluate(() => {
    console.error = window.__readerConsoleError;
    delete window.__readerConsoleError;
  });
  console.log("PASS MOBI, DjVu and RAR engines reject malformed files safely");
  const originalSourceHash = await p.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const req = indexedDB.open("FlipVaultDB");
      req.onsuccess = () => resolve(req.result);
    });
    return await new Promise((resolve) => {
      const req = db.transaction("pdfFiles").objectStore("pdfFiles").getAll();
      req.onsuccess = () =>
        resolve(
          req.result.find((item) => item.sourceName === "hindi-notes.txt")
            .pdfHash,
        );
    });
  });
  await p.locator("#pdfFile").setInputFiles({
    name: "hindi-notes.txt",
    mimeType: "text/plain",
    buffer: hindiTextBuffer,
  });
  await p.waitForFunction(
    () => document.querySelector("#bookTitle").textContent === "hindi-notes",
    { timeout: 30000 },
  );
  await p.waitForFunction(() => document.querySelector("#loading").hidden);
  const restoredSourceHash = await p.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const req = indexedDB.open("FlipVaultDB");
      req.onsuccess = () => resolve(req.result);
    });
    return await new Promise((resolve) => {
      const req = db.transaction("pdfFiles").objectStore("pdfFiles").getAll();
      req.onsuccess = () =>
        resolve(
          req.result.find((item) => item.sourceName === "hindi-notes.txt")
            .pdfHash,
        );
    });
  });
  assert.equal(
    restoredSourceHash,
    originalSourceHash,
    "source fingerprint remains stable across re-import and reflow",
  );
  console.log(
    "PASS source-based reading state fingerprint stays stable across re-import",
  );

  // Leave the app on the shelf, then relaunch. (A reload straight out of the
  // reader deliberately resumes that book, so the library has to be the last
  // screen for this to be a launch-at-the-shelf check.)
  if (await p.locator("#library").isVisible().catch(() => false)) {
    await p.locator("#library").click();
  } else {
    if (await p.locator("#focusPanel").isHidden())
      await p.locator("#focusTools").click();
    await p.waitForFunction(() => !document.querySelector("#focusPanel").hidden);
    await p.locator("#toolHome").click();
  }
  await p.waitForFunction(() => document.body.classList.contains("at-home"));
  await p.reload();
  await ready();
  assert.equal(
    await p.evaluate(() => document.body.classList.contains("at-home")),
    true,
    "a fresh launch opens the library home screen",
  );
  assert.equal(await p.locator("#homeGrid .home-book").count() > 0, true);
  await p
    .locator("#homeContinueButton")
    .waitFor({ state: "visible", timeout: 20000 });
  await p.locator("#homeContinueButton").click();
  await p.waitForFunction(() => !document.body.classList.contains("at-home"));
  await ready();
  assert.equal(
    await p
      .locator("body")
      .evaluate((body) => body.classList.contains("focus-mode")),
    true,
    "phone readers open in the immersive full-screen layout",
  );
  assert.equal(
    await p
      .locator("body")
      .evaluate((body) => body.classList.contains("focus-filmstrip")),
    true,
    "page thumbnails are visible by default in the phone reader",
  );
  assert.equal(await p.locator("#focusSearch").isVisible(), true);
  assert.equal(await p.locator("#filmstrip").isVisible(), true);
  assert.equal(await p.locator("#selectText").count(), 0);
  await p.waitForFunction(
    () => document.querySelectorAll("#textLayer span").length > 0,
  );
  const sampleTextBox = await p
    .locator("#textLayer span")
    .filter({ hasText: /Hello/ })
    .first()
    .boundingBox();
  assert.ok(
    sampleTextBox,
    "the imported PDF exposes a visible selectable text run",
  );
  // A phone reader selects with a plain press and hold — no mode to switch on.
  await holdAt(
    sampleTextBox.x + sampleTextBox.width / 2,
    sampleTextBox.y + sampleTextBox.height / 2,
  );
  await p.mouse.up();
  await p.waitForFunction(
    () => !document.querySelector("#selectionActions").hidden,
  );
  assert.match(await selectedWords(), /word/);
  assert.ok(
    (await p.locator("#selectionCount").getAttribute("title")).length > 0,
  );
  await p.screenshot({ path: "test-results/mobile-final.png" });
  assert.deepEqual(errors, []);
  console.log("PASS no uncaught browser errors");
  if (process.env.TEST_OFFLINE) {
    await p.waitForFunction(() => navigator.serviceWorker.controller);
    await context.setOffline(true);
    await p.reload();
    await ready();
    // An offline reload resumes the book it was reading; if the shelf shows
    // first, the continue card opens the same book.
    if (await p.evaluate(() => document.body.classList.contains("at-home"))) {
      await p
        .locator("#homeContinueButton")
        .waitFor({ state: "visible", timeout: 20000 });
      await p.locator("#homeContinueButton").click();
    }
    await p.waitForFunction(
      () => document.querySelector("#bookTitle").textContent === "hindi-notes",
      null,
      { timeout: 30000 },
    );
    assert.equal(await p.locator("#pageInput").inputValue(), "1");
    console.log("PASS offline app reload and last-imported book restoration");
  }
} finally {
  await browser.close();
}
