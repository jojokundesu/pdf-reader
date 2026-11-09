import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { launch } from "./browser.mjs";
const doc = await PDFDocument.create(),
  font = await doc.embedFont(StandardFonts.Helvetica);
for (let i = 1; i <= 1000; i++) {
  const page = doc.addPage([600, 800]);
  page.drawText(`Virtualized reading test - Page ${i}`, {
    x: 40,
    y: 740,
    size: 22,
    font,
  });
}
const buffer = Buffer.from(await doc.save());
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 830 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.TEST_URL || "http://localhost:4173");
  await page.waitForFunction(
    () => document.querySelectorAll(".thumb").length === 12,
  );
  await page.waitForFunction(async () => {
    if (document.querySelector("#dialog")?.open) return true;
    const db = await new Promise((resolve) => {
      const request = indexedDB.open("FlipVaultDB");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
    if (!db) return false;
    return await new Promise((resolve) => {
      const request = db
        .transaction("settings")
        .objectStore("settings")
        .get("tutorialSeen");
      request.onsuccess = () => resolve(request.result === true);
      request.onerror = () => resolve(false);
    });
  });
  if (await page.locator("#tutorialSkip").isVisible())
    await page.locator("#tutorialSkip").click();
  await page.waitForFunction(async () => {
    if (document.querySelector("#dialog")?.open) return false;
    const db = await new Promise((resolve) => {
      const request = indexedDB.open("FlipVaultDB");
      request.onsuccess = () => resolve(request.result);
    });
    return await new Promise((resolve) => {
      const request = db
        .transaction("settings")
        .objectStore("settings")
        .get("tutorialSeen");
      request.onsuccess = () => resolve(request.result === true);
    });
  });
  const started = performance.now();
  await page.locator("#pdfFile").setInputFiles({
    name: "1000-page-study.pdf",
    mimeType: "application/pdf",
    buffer,
  });
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".thumb").length === 1000 &&
      document.querySelector("#loading").hidden,
    undefined,
    { timeout: 30000 },
  );
  await page.locator("#focusTools").click();
  for (const n of [500, 1000, 1]) {
    await page.locator('[data-focus="page"]').click();
    await page.locator("#focusPageInput").fill(String(n));
    await page.locator("#goToFocusPage").click();
    await page.waitForFunction(
      (n) =>
        document.querySelector("#pageInput").value === String(n) &&
        document.querySelector("#loading").hidden,
      n,
    );
    assert.ok(
      await page
        .locator("#pdfCanvas")
        .evaluate((c) => c.width * c.height <= 4500000 + 10000),
    );
    assert.ok((await page.locator("canvas").count()) <= 6);
  }
  assert.deepEqual(errors, []);
  console.log(
    `PASS 1,000-page PDF import and random navigation at mobile size (${Math.round(performance.now() - started)} ms, ${Math.round(buffer.length / 1024)} KB fixture). Visible canvas count stays bounded.`,
  );
} finally {
  await browser.close();
}
