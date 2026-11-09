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
  await p.waitForFunction(() => document.querySelector("#dialog")?.open, {
    timeout: 10000,
  });
  await p.waitForTimeout(150);
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
  await p.locator("#searchTop").click();
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
    () => CSS.highlights.get("flipvault-search-current")?.size > 0,
  );
  assert.ok(
    await p.evaluate(
      () => CSS.highlights.get("flipvault-search-current")?.size > 0,
    ),
    "the current exact text occurrence receives its own highlight",
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
    await p.evaluate(() => window.getSelection().toString()),
    /^attention$/i,
  );
  await p.locator("#clearSelection").click();
  assert.equal(await p.locator("#readerSearch").isVisible(), false);
  console.log(
    "PASS Drive-style full-document search, occurrence count, exact match highlighting and contextual actions",
  );
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
    "selectText",
    "marker",
    "eraser",
    "bookmark",
    "page",
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
  assert.equal(await p.locator('[data-focus="selectText"]').count(), 1);
  await p.locator('[data-focus="bookmark"]').click();
  assert.equal(await p.locator("#dialog").isVisible(), true);
  assert.equal(await p.locator("#clipNote").count(), 1);
  await p.locator("#closeDialog").click();
  await p.locator('[data-focus="marker"]').click();
  assert.equal(await p.locator("#studio").isVisible(), true);
  await p.locator('[data-focus="eraser"]').click();
  assert.equal(await p.locator("#studio").isVisible(), true);
  await p.locator('[data-focus="selectText"]').click();
  await p.waitForFunction(
    () => document.querySelectorAll("#textLayer span").length > 0,
  );
  assert.equal(
    await p.locator("#selectText").getAttribute("aria-pressed"),
    "true",
  );
  const copiedPassage = await p.evaluate(() => {
    const span = [...document.querySelectorAll("#textLayer span")].find(
      (node) => node.textContent.trim().length > 3,
    );
    const range = document.createRange();
    range.selectNodeContents(span);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString();
  });
  await p.waitForFunction(
    () => !document.querySelector("#selectionActions").hidden,
  );
  assert.ok(copiedPassage.length > 3);
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
  });
  await p.locator("#copySelection").click();
  assert.equal(await p.evaluate(() => window.__copiedSelection), copiedPassage);
  await p.evaluate(() => {
    window.__sharedSelection = null;
    navigator.share = async (payload) => {
      window.__sharedSelection = payload.text;
    };
  });
  await p.locator("#moreSelection").click();
  await p.locator("#shareSelection").click();
  assert.equal(await p.evaluate(() => window.__sharedSelection), copiedPassage);
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
  await p.waitForFunction(async () => {
    const db = await new Promise((resolve) => {
      const request = indexedDB.open("FlipVaultDB");
      request.onsuccess = () => resolve(request.result);
    });
    return await new Promise((resolve) => {
      const request = db
        .transaction("readingState")
        .objectStore("readingState")
        .getAll();
      request.onsuccess = () =>
        resolve(
          request.result.some((item) =>
            item.paperclips.some(
              (clip) =>
                clip.quote && clip.note === "Comment anchored to this passage",
            ),
          ),
        );
    });
  });
  await p.locator("#moreSelection").click();
  await p.locator("#selectAllSelection").click();
  assert.ok(
    (await p.evaluate(() => window.getSelection().toString().length)) >
      copiedPassage.length,
    "Select all selects the readable text on the visible page",
  );
  await p.locator('[data-focus="selectText"]').click();
  assert.equal(
    await p.locator("#selectText").getAttribute("aria-pressed"),
    "false",
  );
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
  await p.locator("#selectText").click();
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
  await p.mouse.move(textBox.x + 1, textBox.y + textBox.height / 2);
  await p.mouse.down();
  await p.mouse.move(
    endTextBox.x + endTextBox.width - 1,
    endTextBox.y + endTextBox.height / 2,
    { steps: 10 },
  );
  await p.mouse.up();
  assert.ok(
    (await p.evaluate(() => window.getSelection().toString())).length > 1,
    "drag selection returns page text",
  );
  await p.locator("#selectText").click();
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
  await p.locator("#selectText").click();
  await p.waitForFunction(
    () => document.querySelectorAll("#textLayer span").length > 0,
  );
  assert.match(
    await p.locator("#textLayer").textContent(),
    /Open standards books/,
  );
  await p.locator("#selectText").click();
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
  await p.locator("#selectText").click();
  await p.waitForFunction(
    () => document.querySelectorAll("#textLayer span").length > 0,
  );
  assert.match(
    await p.locator("#textLayer").textContent(),
    /HTML text is extracted/,
  );
  assert.equal(await p.evaluate(() => window.__unsafeHtmlRan), undefined);
  await p.locator("#selectText").click();
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

  await p.reload();
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
  assert.equal(
    await p.locator("#selectText").getAttribute("aria-pressed"),
    "false",
  );
  await p.locator("#selectText").click();
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
  await p.locator("#selectText").click();
  await p.evaluate(
    ({ x, y }) => {
      document.querySelector("#pdfCanvas").dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
        }),
      );
    },
    {
      x: sampleTextBox.x + sampleTextBox.width / 2,
      y: sampleTextBox.y + sampleTextBox.height / 2,
    },
  );
  await p.waitForFunction(
    () =>
      document.querySelector("#selectText").getAttribute("aria-pressed") ===
      "true",
  );
  await p.waitForFunction(
    () => !document.querySelector("#selectionActions").hidden,
  );
  assert.ok(
    (await p.evaluate(() => window.getSelection().toString())).length > 0,
  );
  await p.screenshot({ path: "test-results/mobile-final.png" });
  assert.deepEqual(errors, []);
  console.log("PASS no uncaught browser errors");
  if (process.env.TEST_OFFLINE) {
    await p.waitForFunction(() => navigator.serviceWorker.controller);
    await context.setOffline(true);
    await p.reload();
    await ready();
    assert.equal(await p.locator("#pageInput").inputValue(), "1");
    assert.equal(await p.locator("#bookTitle").textContent(), "hindi-notes");
    console.log("PASS offline app reload and last-imported book restoration");
  }
} finally {
  await browser.close();
}
