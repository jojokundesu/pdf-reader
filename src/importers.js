import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import "regenerator-runtime/runtime.js";
import latinFontUrl from "./assets/fonts/noto-sans-latin.woff?url";
import devanagariFontUrl from "./assets/fonts/noto-sans-devanagari.woff?url";
import bengaliFontUrl from "./assets/fonts/noto-sans-bengali.woff?url";
import tamilFontUrl from "./assets/fonts/noto-sans-tamil.woff?url";
import teluguFontUrl from "./assets/fonts/noto-sans-telugu.woff?url";

const MAX_BOOK_BYTES = 250 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 5000;
const MAX_UNPACKED_BYTES = 500 * 1024 * 1024;
const IMAGE_EXT = /\.(?:avif|bmp|gif|jpe?g|png|webp)$/i;
const ACCEPTED = new Set([
  "pdf",
  "epub",
  "mobi",
  "azw",
  "azw3",
  "cbz",
  "cbr",
  "djvu",
  "djv",
  "txt",
  "html",
  "htm",
]);

export function extensionOf(name = "") {
  return name.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase() || "";
}
export function supportsBook(name) {
  return ACCEPTED.has(extensionOf(name));
}
export function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
export function wrapText(text, maxWidth, measure) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}
function safeTitle(name) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[\\/:*?"<>|]/g, " ")
      .trim() || "Untitled book"
  );
}
function checkInput(file) {
  if (!file?.size) throw Error("This file is empty.");
  if (file.size > MAX_BOOK_BYTES)
    throw Error("This book is larger than the 250 MB import limit.");
  if (!supportsBook(file.name))
    throw Error(`FlipVault cannot read .${extensionOf(file.name)} files yet.`);
}
function checkArchive(zip) {
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_ARCHIVE_ENTRIES)
    throw Error("This archive contains too many files to import safely.");
  const unpacked = entries.reduce(
    (sum, entry) => sum + (entry._data?.uncompressedSize || 0),
    0,
  );
  if (unpacked > MAX_UNPACKED_BYTES)
    throw Error("This archive expands beyond the safe 500 MB import limit.");
  return entries;
}
function normalizeZipPath(base, href) {
  const clean = decodeURIComponent(href.split("#")[0].split("?")[0]);
  const parts = (base ? `${base}/${clean}` : clean).split("/");
  const out = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}
function documentBlocks(markup) {
  const doc = new DOMParser().parseFromString(markup, "text/html");
  doc
    .querySelectorAll(
      "script,style,link,meta,nav,svg,iframe,object,form,button",
    )
    .forEach((n) => n.remove());
  const blocks = [];
  const add = (node, kind = "body") => {
    const text = (node.textContent || "").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ text, kind });
  };
  const walk = (node) => {
    for (const child of node.children || []) {
      const tag = child.tagName.toLowerCase();
      if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag))
        add(child, "heading");
      else if (
        [
          "p",
          "pre",
          "blockquote",
          "li",
          "figcaption",
          "td",
          "th",
          "dt",
          "dd",
        ].includes(tag)
      )
        add(child, tag === "pre" ? "pre" : "body");
      else if (tag === "img" && child.getAttribute("alt"))
        add(child.getAttribute("alt"), "caption");
      else if (["br", "hr"].includes(tag)) continue;
      else if (
        child.querySelector(
          "h1,h2,h3,h4,h5,h6,p,pre,blockquote,li,figcaption,td,th,dt,dd",
        )
      )
        walk(child);
      else add(child, "body");
    }
  };
  walk(doc.body || doc.documentElement);
  if (!blocks.length) {
    const text = (doc.body?.textContent || "").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ text, kind: "body" });
  }
  return blocks;
}
function decodeText(buffer) {
  const bytes = new Uint8Array(buffer);
  let text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (text.includes("\u0000")) text = new TextDecoder("utf-16le").decode(bytes);
  return text.replace(/^\uFEFF/, "");
}
async function loadFonts(doc) {
  doc.registerFontkit(fontkit);
  const urls = [
    latinFontUrl,
    devanagariFontUrl,
    bengaliFontUrl,
    tamilFontUrl,
    teluguFontUrl,
  ];
  const binaries = await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok)
        throw Error("The offline reading fonts could not be loaded.");
      return response.arrayBuffer();
    }),
  );
  const [latin, devanagari, bengali, tamil, telugu, fallback] =
    await Promise.all([
      ...binaries.map((font) => doc.embedFont(font, { subset: true })),
      doc.embedFont(StandardFonts.Helvetica),
    ]);
  const setOf = (font) => new Set(font.getCharacterSet());
  return {
    latin,
    devanagari,
    bengali,
    tamil,
    telugu,
    fallback,
    latinSet: setOf(latin),
    scripts: [
      { font: devanagari, chars: setOf(devanagari), from: 0x0900, to: 0x097f },
      { font: bengali, chars: setOf(bengali), from: 0x0980, to: 0x09ff },
      { font: tamil, chars: setOf(tamil), from: 0x0b80, to: 0x0bff },
      { font: telugu, chars: setOf(telugu), from: 0x0c00, to: 0x0c7f },
    ],
  };
}
function fontForChar(char, fonts) {
  const code = char.codePointAt(0);
  const script = fonts.scripts.find(
    (candidate) =>
      code >= candidate.from &&
      code <= candidate.to &&
      candidate.chars.has(code),
  );
  if (script) return script.font;
  if (fonts.latinSet.has(code)) return fonts.latin;
  return fonts.fallback;
}
function textRuns(text, fonts) {
  const runs = [];
  for (const char of [...String(text)]) {
    const font = fontForChar(char, fonts);
    const safe =
      font === fonts.fallback && char.codePointAt(0) > 0xff ? "?" : char;
    const last = runs[runs.length - 1];
    if (last?.font === font) last.text += safe;
    else runs.push({ font, text: safe });
  }
  return runs;
}
function measureRuns(runs, size) {
  return runs.reduce(
    (sum, run) => sum + run.font.widthOfTextAtSize(run.text, size),
    0,
  );
}
function wrapRuns(text, maxWidth, size, fonts) {
  const lines = [];
  let line = [],
    width = 0;
  const push = () => {
    if (line.length) lines.push(line);
    line = [];
    width = 0;
  };
  for (const word of String(text).trim().split(/\s+/).filter(Boolean)) {
    const runs = textRuns(word, fonts);
    const gap = line.length ? fonts.latin.widthOfTextAtSize(" ", size) : 0;
    const wordWidth = measureRuns(runs, size);
    if (line.length && width + gap + wordWidth > maxWidth) push();
    if (!line.length && wordWidth > maxWidth) {
      for (const run of runs)
        for (const char of [...run.text]) {
          const font = run.font;
          if (
            line.length &&
            width + font.widthOfTextAtSize(char, size) > maxWidth
          )
            push();
          line.push({ font, text: char });
          width += font.widthOfTextAtSize(char, size);
        }
      push();
      continue;
    }
    if (line.length) {
      line.push({ font: fonts.latin, text: " " });
      width += gap;
    }
    line.push(...runs);
    width += wordWidth;
  }
  push();
  return lines;
}
async function textPdf(title, blocks, metadata = {}) {
  if (!blocks.length) throw Error("No readable text was found in this book.");
  if (
    blocks.length > 100_000 ||
    blocks.reduce((size, block) => size + block.text.length, 0) > 4_000_000
  )
    throw Error(
      "This book has more text than the safe offline reflow limit. Split it into smaller parts and try again.",
    );
  const doc = await PDFDocument.create();
  const fonts = await loadFonts(doc);
  const pageW = 612,
    pageH = 792,
    marginX = 56,
    top = 64,
    bottom = 56,
    usable = pageW - marginX * 2;
  let page = doc.addPage([pageW, pageH]),
    y = pageH - top;
  const drawLine = (runs, kind, firstLine = false) => {
    const size =
      kind === "title"
        ? 22
        : kind === "heading"
          ? 15
          : kind === "caption"
            ? 9
            : 10.5;
    const height = size * (kind === "title" ? 1.35 : 1.55);
    if (y - height < bottom) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - top;
    }
    let x = marginX + (kind === "body" && !firstLine ? 8 : 0);
    for (const run of runs) {
      page.drawText(run.text, {
        x,
        y: y - size,
        size,
        font: run.font,
        color: rgb(0.12, 0.14, 0.13),
      });
      x += run.font.widthOfTextAtSize(run.text, size);
    }
    y -= height;
    if (kind === "heading") y -= 4;
  };
  const drawParagraph = (text, kind) => {
    const size = kind === "heading" ? 15 : kind === "caption" ? 9 : 10.5;
    const available = usable - (kind === "body" ? 8 : 0);
    wrapRuns(text, available, size, fonts).forEach((line, i) =>
      drawLine(line, kind, i === 0),
    );
  };
  drawLine(textRuns(title, fonts), "title");
  y -= 10;
  if (metadata.author) {
    drawParagraph(`By ${metadata.author}`, "caption");
    y -= 18;
  } else y -= 10;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const kind = block.kind || "body";
    if (kind === "heading") y -= 10;
    drawParagraph(block.text, kind);
    y -= kind === "heading" ? 5 : 9;
    if (i > 0 && i % 80 === 0)
      await new Promise((resolve) => setTimeout(resolve, 0));
  }
  doc.setTitle(title);
  if (metadata.author) doc.setAuthor(metadata.author);
  doc.setSubject("Imported for offline reading in FlipVault Pro");
  return new Uint8Array(await doc.save({ useObjectStreams: true }));
}
async function comicPdf(files, title) {
  if (!files.length)
    throw Error("This comic archive contains no supported image pages.");
  if (files.length > 1000)
    throw Error("This comic has more than 1,000 image pages.");
  const doc = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    const { name, bytes } = files[i];
    const dimensions = imageDimensions(name, bytes);
    if (dimensions && dimensions.width * dimensions.height > 50_000_000)
      throw Error(
        `Comic page ${name} is too large to decode safely (over 50 megapixels).`,
      );
    const oversized =
      dimensions &&
      (dimensions.width > 3000 ||
        dimensions.height > 3000 ||
        dimensions.width * dimensions.height > 4_500_000);
    let image;
    if (!oversized && /\.jpe?g$/i.test(name)) image = await doc.embedJpg(bytes);
    else if (!oversized && /\.png$/i.test(name))
      image = await doc.embedPng(bytes);
    else {
      const decoded = await rasterImage(bytes, name);
      image =
        decoded.type === "jpeg"
          ? await doc.embedJpg(decoded.bytes)
          : await doc.embedPng(decoded.bytes);
    }
    const dims = image.scale(1);
    const scale = Math.min(
      1,
      3000 / Math.max(dims.width, dims.height),
      Math.sqrt(4_500_000 / (dims.width * dims.height)),
    );
    const width = Math.max(1, dims.width * scale),
      height = Math.max(1, dims.height * scale);
    const page = doc.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
    if (i % 8 === 7) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  doc.setTitle(title);
  doc.setSubject("Comic pages imported for offline reading in FlipVault Pro");
  return new Uint8Array(
    await doc.save({ useObjectStreams: true, objectsPerTick: 50 }),
  );
}
function imageDimensions(name, data) {
  const b = data instanceof Uint8Array ? data : new Uint8Array(data);
  const u32 = (o) =>
    (b[o] * 0x1000000 + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3]) >>> 0;
  if (/\.png$/i.test(name) && b.length >= 24 && u32(0) === 0x89504e47)
    return { width: u32(16), height: u32(20) };
  if (/\.gif$/i.test(name) && b.length >= 10)
    return { width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) };
  if (/\.bmp$/i.test(name) && b.length >= 26)
    return { width: Math.abs(u32(18)), height: Math.abs(u32(22)) };
  if (/\.jpe?g$/i.test(name) && b[0] === 0xff && b[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < b.length) {
      if (b[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = b[offset + 1],
        length = (b[offset + 2] << 8) | b[offset + 3];
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      )
        return {
          height: (b[offset + 5] << 8) | b[offset + 6],
          width: (b[offset + 7] << 8) | b[offset + 8],
        };
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  if (
    /\.webp$/i.test(name) &&
    b.length >= 30 &&
    String.fromCharCode(...b.slice(12, 16)) === "VP8X"
  )
    return {
      width: 1 + b[24] + (b[25] << 8) + (b[26] << 16),
      height: 1 + b[27] + (b[28] << 8) + (b[29] << 16),
    };
  return null;
}
async function rasterImage(bytes, name = "page.png") {
  const mime = /\.jpe?g$/i.test(name)
    ? "image/jpeg"
    : /\.gif$/i.test(name)
      ? "image/gif"
      : /\.webp$/i.test(name)
        ? "image/webp"
        : /\.bmp$/i.test(name)
          ? "image/bmp"
          : "image/png";
  const blob = new Blob([bytes], { type: mime });
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width * bitmap.height > 50_000_000)
      throw Error(
        `Comic page ${name} is too large to decode safely (over 50 megapixels).`,
      );
    const scale = Math.min(
      1,
      3000 / Math.max(bitmap.width, bitmap.height),
      Math.sqrt(4_500_000 / (bitmap.width * bitmap.height)),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const alpha = !/\.jpe?g$/i.test(name);
    const ctx = canvas.getContext("2d", { alpha });
    if (!alpha) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const jpeg = /\.jpe?g$/i.test(name);
    const encoded = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result
            ? result.arrayBuffer().then(resolve)
            : reject(Error("Could not decode a comic page.")),
        jpeg ? "image/jpeg" : "image/png",
        0.88,
      ),
    );
    return { bytes: new Uint8Array(encoded), type: jpeg ? "jpeg" : "png" };
  } finally {
    bitmap.close();
  }
}
async function importText(file, sourceData) {
  const source = decodeText(sourceData);
  const blocks = file.name.match(/\.html?$/i)
    ? documentBlocks(source)
    : source
        .split(/\n\s*\n/)
        .map((part) => ({
          text: part.replace(/\s*\n\s*/g, " ").trim(),
          kind: "body",
        }))
        .filter((part) => part.text);
  return {
    data: await textPdf(safeTitle(file.name), blocks),
    format: extensionOf(file.name),
  };
}
async function importEpub(file, sourceData) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(sourceData, { checkCRC32: false });
  checkArchive(zip);
  const container = zip.file("META-INF/container.xml");
  if (!container) throw Error("This EPUB is missing its package index.");
  const containerXml = new DOMParser().parseFromString(
    await container.async("text"),
    "application/xml",
  );
  const opfPath = containerXml
    .querySelector("rootfile")
    ?.getAttribute("full-path");
  const opfFile = opfPath && zip.file(opfPath);
  if (!opfFile) throw Error("This EPUB has no readable book package.");
  const opf = new DOMParser().parseFromString(
    await opfFile.async("text"),
    "application/xml",
  );
  const base = opfPath.split("/").slice(0, -1).join("/");
  const manifest = new Map(
    [...opf.querySelectorAll("manifest item")].map((item) => [
      item.getAttribute("id"),
      item,
    ]),
  );
  const items = [...opf.querySelectorAll("spine itemref")]
    .map((ref) => manifest.get(ref.getAttribute("idref")))
    .filter(Boolean);
  const title =
    opf.getElementsByTagName("dc:title")[0]?.textContent?.trim() ||
    safeTitle(file.name);
  const author =
    opf.getElementsByTagName("dc:creator")[0]?.textContent?.trim() || "";
  const blocks = [];
  for (let i = 0; i < items.length; i++) {
    const href = items[i].getAttribute("href");
    const entry = zip.file(normalizeZipPath(base, href));
    if (!entry) continue;
    blocks.push(...documentBlocks(await entry.async("text")));
    if (i % 8 === 7) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return {
    data: await textPdf(title, blocks, { author }),
    title,
    format: "epub",
  };
}
async function importMobi(file, sourceData) {
  const { initMobiFile } = await import("@lingo-reader/mobi-parser");
  const mobi = await initMobiFile(new Uint8Array(sourceData));
  try {
    const blocks = [];
    for (const chapter of mobi.getSpine()) {
      const processed = mobi.loadChapter(chapter.id);
      if (processed?.html) blocks.push(...documentBlocks(processed.html));
    }
    const metadata = mobi.getMetadata();
    return {
      data: await textPdf(metadata.title || safeTitle(file.name), blocks, {
        author: metadata.author?.join(", "),
      }),
      title: metadata.title,
      format: extensionOf(file.name),
    };
  } finally {
    mobi.destroy();
  }
}
async function importDjvu(file, sourceData) {
  const djvu = await import("djvu-rs");
  await djvu.default();
  const djvuDocument = djvu.WasmDocument.from_bytes(new Uint8Array(sourceData));
  try {
    const doc = await PDFDocument.create();
    const count = djvuDocument.page_count();
    if (!count) throw Error("This DjVu document contains no pages.");
    if (count > 2000)
      throw Error("This DjVu document has more than 2,000 pages.");
    for (let i = 0; i < count; i++) {
      const sourcePage = djvuDocument.page(i);
      const nativeDpi = Math.max(72, Math.min(300, sourcePage.dpi() || 300));
      const baseW = sourcePage.width_at(72),
        baseH = sourcePage.height_at(72);
      if (!baseW || !baseH)
        throw Error(`DjVu page ${i + 1} has invalid dimensions.`);
      const requestedDpi = Math.min(144, nativeDpi);
      const pixelsAtDpi = baseW * baseH * (requestedDpi / 72) ** 2;
      const shrink = Math.min(
        1,
        3000 / ((Math.max(baseW, baseH) * requestedDpi) / 72),
        Math.sqrt(4_500_000 / pixelsAtDpi),
      );
      const dpi = Math.max(1, requestedDpi * shrink);
      const w = sourcePage.width_at(dpi),
        h = sourcePage.height_at(dpi);
      if (!w || !h || w * h > 4_600_000)
        throw Error(`DjVu page ${i + 1} exceeds the safe render size.`);
      const pix = sourcePage.render(dpi);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas
        .getContext("2d")
        .putImageData(new ImageData(new Uint8ClampedArray(pix), w, h), 0, 0);
      const png = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b
              ? b.arrayBuffer().then(resolve)
              : reject(Error("Could not convert a DjVu page.")),
          "image/png",
        ),
      );
      const image = await doc.embedPng(png);
      const scale = Math.min(
        1,
        3000 / Math.max(w, h),
        Math.sqrt(4_500_000 / (w * h)),
      );
      const width = w * scale,
        height = h * scale;
      const pdfPage = doc.addPage([width, height]);
      pdfPage.drawImage(image, { x: 0, y: 0, width, height });
      if (i % 3 === 2) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const title = safeTitle(file.name);
    doc.setTitle(title);
    doc.setSubject("DjVu pages imported for offline reading in FlipVault Pro");
    return {
      data: new Uint8Array(
        await doc.save({ useObjectStreams: true, objectsPerTick: 20 }),
      ),
      title,
      format: extensionOf(file.name),
    };
  } finally {
    djvuDocument.free();
  }
}
async function importArchive(file, sourceData) {
  let files;
  if (extensionOf(file.name) === "cbz") {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(sourceData, { checkCRC32: false });
    const entries = checkArchive(zip)
      .filter((entry) => IMAGE_EXT.test(entry.name))
      .sort((a, b) => naturalCompare(a.name, b.name));
    files = [];
    for (const entry of entries)
      files.push({ name: entry.name, bytes: await entry.async("uint8array") });
  } else {
    const { readRarImages } = await import("./unrar-import.js");
    files = await readRarImages(sourceData);
  }
  return {
    data: await comicPdf(files, safeTitle(file.name)),
    format: extensionOf(file.name),
  };
}
export async function importBook(file, sourceData = undefined) {
  checkInput(file);
  sourceData ||= await file.arrayBuffer();
  const format = extensionOf(file.name);
  if (format === "pdf")
    return { data: sourceData, title: safeTitle(file.name), format };
  if (format === "txt" || format === "html" || format === "htm")
    return importText(file, sourceData);
  if (format === "epub") return importEpub(file, sourceData);
  if (["mobi", "azw", "azw3"].includes(format))
    return importMobi(file, sourceData);
  if (["cbz", "cbr"].includes(format)) return importArchive(file, sourceData);
  if (["djvu", "djv"].includes(format)) return importDjvu(file, sourceData);
  throw Error("This book format is not supported yet.");
}
