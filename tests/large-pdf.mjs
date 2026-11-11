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
    () => {
      const home = document.body.classList.contains("at-home");
      return (
        document.querySelector("#loading").hidden &&
        (!home || document.querySelectorAll("#homeGrid .home-book").length > 0)
      );
    },
    null,
    { timeout: 40000 },
  );
  // The guided tour is shown right after the library paints; dismiss it.
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await page.locator("#tutorialSkip").isVisible().catch(() => false)) {
      await page.locator("#tutorialSkip").click();
      await page.waitForFunction(() => !document.querySelector("#dialog").open);
      break;
    }
    if (await page.evaluate(() => !document.querySelector("#dialog").open))
      await page.waitForTimeout(150);
  }
  // The app now opens on the library; open the sample book first.
  if (await page.evaluate(() => document.body.classList.contains("at-home"))) {
    await page
      .locator("#homeContinueButton")
      .waitFor({ state: "visible", timeout: 20000 });
    await page.locator("#homeContinueButton").click();
  }
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".thumb").length === 12 &&
      document.querySelector("#loading").hidden,
    null,
    { timeout: 30000 },
  );
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
