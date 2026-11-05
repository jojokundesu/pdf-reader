import { horizontalIntent, interiorFoldPoint, completeTurn } from "./gestures";
import "./style.css";
import {
  createIcons,
  ArrowUpRight,
  BookOpen,
  BookOpenText,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  Coffee,
  Contrast,
  Download,
  Ellipsis,
  Eraser,
  Expand,
  File as FileIcon,
  FileCheck,
  FileDown,
  FolderOpen,
  FolderSync,
  GalleryHorizontalEnd,
  Hand,
  Highlighter,
  Keyboard,
  LibraryBig,
  LockKeyhole,
  Maximize,
  Minimize,
  Minus,
  Moon,
  MoveHorizontal,
  NotebookPen,
  PanelsLeftBottom,
  PanelsTopLeft,
  Paperclip,
  Plus,
  Redo2,
  Search,
  ShieldCheck,
  Smartphone,
  Sun,
  Timer,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from "lucide";
const icons = {
  ArrowUpRight,
  BookOpen,
  BookOpenText,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  Coffee,
  Contrast,
  Download,
  Ellipsis,
  Eraser,
  Expand,
  File: FileIcon,
  FileCheck,
  FileDown,
  FolderOpen,
  FolderSync,
  GalleryHorizontalEnd,
  Hand,
  Highlighter,
  Keyboard,
  LibraryBig,
  LockKeyhole,
  Maximize,
  Minimize,
  Minus,
  Moon,
  MoveHorizontal,
  NotebookPen,
  PanelsLeftBottom,
  PanelsTopLeft,
  Paperclip,
  Plus,
  Redo2,
  Search,
  ShieldCheck,
  Smartphone,
  Sun,
  Timer,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
};
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { PDFDocument, BlendMode } from "pdf-lib";
import * as store from "./storage";
import { AnnotationEngine } from "./annotations";
import { PageCurl } from "./curl";
import { makeDemo } from "./demo";
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const pdfOptions = {
  standardFontDataUrl: import.meta.env.BASE_URL + "standard_fonts/",
  cMapUrl: import.meta.env.BASE_URL + "cmaps/",
  cMapPacked: true,
};
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const icon = (name, cls = "") => `<i data-lucide="${name}" class="${cls}"></i>`;
const btn = (id, name, label, cls = "") =>
  `<button id="${id}" class="icon-btn ${cls}" title="${label}" aria-label="${label}">${icon(name)}</button>`;
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let nativeVaultEnabled = false;
let pdf,
  book,
  state,
  page = 1,
  tool = "hand",
  theme = "original",
  background = "black",
  mode = "auto",
  rtl = false,
  zoom = 1,
  muted = false,
  cache = new Map(),
  thumbs = new Map(),
  textCache = new Map(),
  vaultHandle,
  saveTimer,
  renderToken = 0,
  turning = false,
  searchToken = 0,
  installEvent,
  fullscreen = false;
let brush = { color: "#FFEB3B", width: 18, opacity: 0.38, straight: false },
  eraserMode = "pixel",
  eraserWidth = 32,
  clipColor = "#b9c6ce",
  sessionStart = Date.now(),
  baseSeconds = 0,
  focusEnd = 0,
  saveQueue = Promise.resolve(),
  ready = false,
  gesture = null,
  holdTimer,
  referencePage = 1;
const app = $("#app");
app.innerHTML = `
<aside class="rail"><a class="brand" href="#" aria-label="FlipVault home">${icon("book-open")}</a><div class="rail-group">${btn("library", "library-big", "Your library")}${btn("reader", "book-open-text", "Reading room", "active")}${btn("clips", "paperclip", "Paperclips & notes")}${btn("search", "search", "Search this book")}</div><div class="rail-bottom">${btn("help", "circle-help", "Help & keyboard shortcuts")}<span class="avatar">Y</span></div></aside>
<div class="shell"><header class="topbar hud"><div class="wordmark">FlipVault <span>PRO</span></div><div class="breadcrumb"><span>My library</span>${icon("chevron-right")}<strong id="bookTitle">Opening your reading room…</strong></div><div class="top-actions"><button id="vault" class="vault-pill">${icon("shield-check")}<span>Saved on device</span><b></b></button>${btn("import", "plus", "Import a PDF", "import-btn")}</div></header>
<main><div class="workspace-header hud"><div><div class="eyebrow">YOUR READING ROOM</div><h1>A little less noise. A little more book.</h1></div><button id="focus" class="subtle">${icon("maximize")}<span>Focus mode</span></button></div>
<div class="reader-toolbar hud"><div class="toolbar-group"><button id="layout" class="text-btn">${icon("panels-top-left")}<span>Auto spread</span>${icon("chevron-down")}</button><span class="divider"></span><button id="theme" class="text-btn">${icon("sun")}<span>Original paper</span>${icon("chevron-down")}</button></div><div class="toolbar-group"><span class="tool-label">TOOLS</span>${btn("hand", "hand", "Read & turn pages", "active")}${btn("marker", "highlighter", "Highlight studio")}${btn("eraser", "eraser", "Eraser studio")}${btn("addClip", "paperclip", "Attach a paperclip")}<span class="divider"></span>${btn("undo", "undo-2", "Undo · Ctrl+Z")}${btn("redo", "redo-2", "Redo · Ctrl+Y")}</div><div class="toolbar-group zoom-group">${btn("zoomOut", "minus", "Zoom out")}<button id="zoomValue" class="zoom-value">100%</button>${btn("zoomIn", "plus", "Zoom in")}<span class="divider"></span>${btn("more", "ellipsis", "More reading tools")}</div></div>
<div id="studio" class="studio hud" hidden></div>
<section id="stage" class="stage" aria-label="Interactive PDF reader"><div class="stage-ambient"></div><button id="prev" class="page-nav previous" title="Previous page" aria-label="Previous page">${icon("chevron-left")}</button><div id="bookViewport" class="book-viewport"><div id="bookSurface" class="book-surface"><div id="leftPage" class="page left-page"><canvas id="leftPdf"></canvas><canvas id="leftInk" class="annotation"></canvas><div id="leftUI" class="page-ui"></div></div><div id="rightPage" class="page right-page"><canvas id="pdfCanvas"></canvas><canvas id="highlightCanvas" class="annotation"></canvas><div id="uiLayer" class="page-ui"></div><div id="brushCursor"></div></div><div id="edgeTabs" class="edge-tabs"></div><canvas id="curlCanvas"></canvas></div></div><button id="next" class="page-nav next" title="Next page" aria-label="Next page">${icon("chevron-right")}</button><div id="loading" class="loading" hidden><span class="spinner"></span><span>Preparing your pages…</span></div><div class="stage-caption hud"><span>${icon("move-horizontal")} Hold & drag anywhere to turn the page</span><span id="readingTime">A little time, well spent.</span></div></section>
<footer class="bottom-panel hud"><div class="page-controls"><div class="progress-copy"><span id="progressLabel">YOUR PROGRESS</span><strong id="progressPercent">0%</strong></div><div class="pagination">${btn("first", "chevrons-left", "First page")}${btn("prevSmall", "chevron-left", "Previous page")}<label class="page-input"><input id="pageInput" type="number" min="1" value="1" aria-label="Go to page"><span id="pageTotal">/ 12</span></label>${btn("nextSmall", "chevron-right", "Next page")}${btn("last", "chevrons-right", "Last page")}</div><div class="footer-actions">${btn("sound", "volume-2", "Toggle page sound")}${btn("filmToggle", "gallery-horizontal-end", "Toggle page thumbnails", "active")}${btn("export", "download", "Export & study summary")}</div></div><div id="filmstrip" class="filmstrip" aria-label="Page thumbnails"></div><div class="footer-note"><span>${icon("lock-keyhole")} Your books. Your notes. Only on your device.</span><span id="sessionLabel">MADE FOR SLOW READING</span></div></footer>
</main></div><div id="drawerBackdrop" class="drawer-backdrop" hidden></div><aside id="drawer" class="drawer" hidden></aside><div id="popover" class="popover" hidden></div><button id="exitFocus" class="focus-return" aria-label="Exit focus mode">Exit focus ${icon("minimize")}</button><div id="toast" class="toast" role="status" hidden></div><input id="pdfFile" type="file" accept="application/pdf,.pdf" multiple hidden><input id="vaultFile" type="file" accept=".json,.flipvault,application/json" hidden><dialog id="dialog"></dialog><div id="reference" class="reference" hidden></div>`;
function refreshIcons() {
  createIcons({ icons, attrs: { "stroke-width": 1.65 } });
}
refreshIcons();
const ann = new AnnotationEngine($("#highlightCanvas"), (items) => {
  if (!state) return;
  state.pageAnnotations[page] = items;
  scheduleSave();
  updateFilmMarkers();
});
const curl = new PageCurl($("#curlCanvas"));
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").hidden = true), 4000);
}
function fail(error) {
  console.error(error);
  toast(error.message || "Something went wrong. Please try again.");
  $("#loading").hidden = true;
}
const run =
  (fn) =>
  (...a) =>
    Promise.resolve()
      .then(() => fn(...a))
      .catch(fail);
function on(id, fn) {
  $("#" + id).addEventListener("click", run(fn));
}
function getState(hash) {
  return {
    pdfHash: hash,
    lastPage: 1,
    zoomLevel: 1,
    readingMode: "auto",
    theme: "original",
    rtl: false,
    totalReadingTimeSeconds: 0,
    lastOpenedTimestamp: Date.now(),
    paperclips: [],
    pageAnnotations: {},
    readingGoal: 20,
  };
}
async function save() {
  if (!state) return;
  state.lastPage = page;
  state.zoomLevel = zoom;
  state.readingMode = mode;
  state.theme = theme;
  state.rtl = rtl;
  state.totalReadingTimeSeconds =
    baseSeconds + Math.floor((Date.now() - sessionStart) / 1000);
  state.lastOpenedTimestamp = Date.now();
  const snapshot = structuredClone(state);
  saveQueue = saveQueue
    .catch(() => {})
    .then(async () => {
      await store.put("readingState", snapshot);
      await store.put("settings", snapshot.pdfHash, "activePdfHash");
      $("#vault span").textContent =
        vaultHandle || nativeVaultEnabled ? "Vault synced" : "Saved on device";
      if (nativeVaultEnabled) {
        try {
          await store.syncNativeVault(await store.vaultData());
        } catch (e) {
          nativeVaultEnabled = false;
          toast("Auto-backup needs attention. Open Vault to enable it again.");
        }
      }
      if (vaultHandle) {
        try {
          const writable = await vaultHandle.createWritable();
          await writable.write(JSON.stringify(await store.vaultData()));
          await writable.close();
        } catch (e) {
          $("#vault span").textContent = "Backup needs attention";
          toast("Local backup failed. Relink your vault file.");
          vaultHandle = null;
        }
      }
    });
  return saveQueue;
}
function scheduleSave() {
  clearTimeout(saveTimer);
  $("#vault span").textContent = "Saving…";
  saveTimer = setTimeout(() => save().catch(fail), 350);
}
async function importPDF(file) {
  $("#loading").hidden = false;
  const buffer = await file.arrayBuffer(),
    hash = await store.fingerprint(buffer);
  let existing = await store.get("pdfFiles", hash);
  if (!existing) {
    const doc = await pdfjs.getDocument({
      ...pdfOptions,
      data: buffer.slice(0),
    }).promise;
    const p = await doc.getPage(1),
      vp = p.getViewport({ scale: 0.35 }),
      c = document.createElement("canvas");
    c.width = vp.width;
    c.height = vp.height;
    await p.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    existing = {
      pdfHash: hash,
      data: buffer,
      title: file.name.replace(/\.pdf$/i, ""),
      pageCount: doc.numPages,
      fileSize: buffer.byteLength,
      cover: c.toDataURL("image/webp", 0.7),
      importedAt: Date.now(),
    };
    await doc.destroy();
    await store.put("pdfFiles", existing);
  }
  await openBook(existing);
  toast("Your book is ready. Make yourself at home.");
}
async function openBook(b) {
  if (state) await save();
  renderToken++;
  if (pdf) await pdf.destroy();
  cache.clear();
  thumbs.clear();
  textCache.clear();
  book = b;
  pdf = await pdfjs.getDocument({ ...pdfOptions, data: b.data.slice(0) })
    .promise;
  state = (await store.get("readingState", b.pdfHash)) || getState(b.pdfHash);
  page = Math.max(1, Math.min(pdf.numPages, state.lastPage));
  zoom = state.zoomLevel || 1;
  mode = state.readingMode || "auto";
  theme = state.theme || "original";
  rtl = !!state.rtl;
  baseSeconds = state.totalReadingTimeSeconds || 0;
  sessionStart = Date.now();
  $("#bookTitle").textContent = b.title;
  $("#pageTotal").textContent = "/ " + pdf.numPages;
  $("#pageInput").max = pdf.numPages;
  applyTheme();
  closeDrawer();
  await render();
  buildFilm();
  await save();
  ready = true;
}
function isSpread() {
  return (
    page > 1 &&
    (mode === "spread" ||
      (mode === "auto" && innerWidth > 1050 && innerHeight > 600))
  );
}
function fitSize() {
  const stage = $("#stage"),
    spread = isSpread(),
    aspect = cache.get(page)?.aspect || 0.737;
  const h = Math.min(
    stage.clientHeight - 78,
    (stage.clientWidth - (innerWidth < 650 ? 38 : 170)) /
      (aspect * (spread ? 2 : 1)),
  );
  return { h: Math.max(140, h), w: Math.max(140, h) * aspect };
}
async function getPageCanvas(n, scaleBoost = zoom) {
  if (n < 1 || n > pdf.numPages) return null;
  const target = Math.min(2, devicePixelRatio || 1) * Math.min(scaleBoost, 3),
    key = n;
  const old = cache.get(key);
  if (old && old.res >= target) return old;
  const p = await pdf.getPage(n),
    v = p.getViewport({ scale: 1 });
  const size = fitSize();
  let scale = Math.min(
    (target * size.h) / v.height,
    Math.sqrt(4500000 / (v.width * v.height)),
  );
  const vp = p.getViewport({ scale }),
    c = document.createElement("canvas");
  c.width = Math.ceil(vp.width);
  c.height = Math.ceil(vp.height);
  await p.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
  const entry = {
    canvas: c,
    aspect: v.width / v.height,
    res: target,
    pdfWidth: v.width,
    pdfHeight: v.height,
  };
  if (Math.abs(n - page) <= 2) cache.set(key, entry);
  return entry;
}
function drawClips(ctx, n, w, h) {
  for (const c of state.paperclips.filter((c) => c.page === n)) {
    const x = c.edge === "right" ? w - 13 : c.position * w,
      y = c.edge === "top" ? 5 : c.edge === "bottom" ? h - 48 : c.position * h;
    ctx.save();
    ctx.translate(x, y);
    if (c.edge === "right") ctx.rotate(Math.PI / 2);
    const s = w / 560;
    ctx.scale(s, s);
    ctx.shadowColor = "#0006";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 3;
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(4, 33);
    ctx.lineTo(4, 3);
    ctx.bezierCurveTo(4, -13, 24, -13, 24, 3);
    ctx.lineTo(24, 37);
    ctx.bezierCurveTo(24, 50, -4, 50, -4, 35);
    ctx.lineTo(-4, 1);
    ctx.stroke();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#ffffff99";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
}
async function composite(n) {
  const e = await getPageCanvas(n);
  if (!e) return null;
  const c = document.createElement("canvas");
  c.width = e.canvas.width;
  c.height = e.canvas.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(e.canvas, 0, 0);
  const a = document.createElement("canvas");
  a.width = c.width;
  a.height = c.height;
  const engine = new AnnotationEngine(a, () => {});
  engine.logicalHeight = 1000 / e.aspect;
  engine.items = state.pageAnnotations[n] || [];
  engine.render();
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(a, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  drawClips(ctx, n, c.width, c.height);
  return c;
}
async function render() {
  if (!pdf) return;
  const token = ++renderToken;
  $("#loading").hidden = false;
  const entry = await getPageCanvas(page);
  if (token !== renderToken) return;
  const spread = isSpread();
  $("#bookSurface").classList.toggle("spread", spread);
  const size = fitSize();
  $("#bookSurface").style.setProperty("--page-w", size.w + "px");
  $("#bookSurface").style.setProperty("--page-h", size.h + "px");
  $("#bookSurface").style.setProperty("--zoom", zoom);
  $("#bookViewport").classList.toggle("zoomed", zoom > 1);
  const c = $("#pdfCanvas");
  c.width = entry.canvas.width;
  c.height = entry.canvas.height;
  c.getContext("2d").drawImage(entry.canvas, 0, 0);
  const ink = $("#highlightCanvas");
  ink.width = c.width;
  ink.height = c.height;
  ann.logicalHeight = 1000 / entry.aspect;
  ann.load(state.pageAnnotations[page] || [], book.pdfHash + ":" + page);
  $("#leftPage").hidden = !spread;
  if (spread) {
    const leftNum = page > 1 ? page - 1 : Math.min(2, pdf.numPages);
    const left = await getPageCanvas(leftNum);
    if (token !== renderToken) return;
    const lc = $("#leftPdf");
    lc.width = left.canvas.width;
    lc.height = left.canvas.height;
    lc.getContext("2d").drawImage(left.canvas, 0, 0);
    const li = $("#leftInk");
    li.width = lc.width;
    li.height = lc.height;
    const le = new AnnotationEngine(li, () => {});
    le.logicalHeight = 1000 / left.aspect;
    le.items = state.pageAnnotations[leftNum] || [];
    le.render();
    renderPageClips($("#leftUI"), leftNum);
    $("#leftPage").dataset.page = leftNum;
  }
  renderPageClips($("#uiLayer"), page);
  renderTabs();
  $("#pageInput").value = page;
  $("#progressPercent").textContent =
    Math.round((page / pdf.numPages) * 100) + "%";
  $("#zoomValue").textContent = Math.round(zoom * 100) + "%";
  $("#layout span").textContent =
    mode === "auto"
      ? "Auto spread"
      : mode === "spread"
        ? "Book spread"
        : "Single page";
  $$(".thumb").forEach((el) =>
    el.classList.toggle("selected", +el.dataset.page === page),
  );
  $("#loading").hidden = true;
  $("#prev").disabled = page === 1;
  $("#next").disabled = page === pdf.numPages;
  cache.forEach((v, n) => {
    if (Math.abs(n - page) > 2) {
      v.canvas.width = 1;
      cache.delete(n);
    }
  });
  scheduleSave();
  updateReadingStats();
  if ($("#reference").hidden === false) showReference(referencePage);
}
async function go(n, animate = false) {
  n = Math.max(1, Math.min(pdf.numPages, Math.round(n)));
  if (n === page || turning || !Number.isFinite(n)) return;
  if (gesture?.drawing) {
    ann.finish();
    gesture = null;
  }
  if (animate && Math.abs(n - page) === 1 && zoom === 1) {
    await turn(n > page ? 1 : -1);
    return;
  }
  page = n;
  await render();
  $("#filmstrip .selected")?.scrollIntoView({
    block: "nearest",
    inline: "center",
    behavior: "smooth",
  });
}
async function turn(dir) {
  if (turning || page + dir < 1 || page + dir > pdf.numPages) return;
  turning = true;
  try {
    const current = await composite(page),
      next = await composite(page + dir);
    curl.begin(current, next, current.height * 0.88, rtl ? dir > 0 : dir < 0);
    curl.p = { x: current.width * 0.8, y: current.height * 0.86 };
    curl.draw();
    sound(0.7);
    curl.release(true, () => {
      page += dir;
      render()
        .catch(fail)
        .finally(() => (turning = false));
    });
  } catch (e) {
    turning = false;
    throw e;
  }
}
function clipSVG(color) {
  return `<svg viewBox="0 0 32 66" class="metal-clip"><defs><linearGradient id="metal-${color.replace("#", "")}" x1="0" x2="1"><stop stop-color="#fff"/><stop offset=".22" stop-color="${color}"/><stop offset=".55" stop-color="#fff"/><stop offset=".73" stop-color="${color}"/><stop offset="1" stop-color="#555"/></linearGradient></defs><path d="M10 48V15C10 2 29 2 29 15V49C29 69 2 69 2 49V13C2-4 23-4 23 13V47C23 56 15 56 15 47V18" fill="none" stroke="url(#metal-${color.replace("#", "")})" stroke-width="3.8" stroke-linecap="round"/></svg>`;
}
function renderPageClips(el, n) {
  el.innerHTML = state.paperclips
    .filter((c) => c.page === n)
    .map(
      (c) =>
        `<button class="physical-clip ${c.edge}" data-id="${c.id}" style="--pos:${c.position * 100}%" title="${esc(c.note || "Paperclip")}" aria-label="Paperclip: ${esc(c.note || "Untitled")}">${clipSVG(c.color)}</button>`,
    )
    .join("");
  el.querySelectorAll(".physical-clip").forEach((b) => {
    let moved = false;
    const c = state.paperclips.find((c) => c.id === b.dataset.id);
    b.onpointerdown = (e) => {
      e.stopPropagation();
      b.setPointerCapture(e.pointerId);
    };
    b.onpointermove = (e) => {
      if (!b.hasPointerCapture(e.pointerId)) return;
      moved = true;
      const r = el.getBoundingClientRect();
      c.position = Math.max(
        0.04,
        Math.min(
          0.94,
          c.edge === "right"
            ? (e.clientY - r.top) / r.height
            : (e.clientX - r.left) / r.width,
        ),
      );
      b.style.setProperty("--pos", c.position * 100 + "%");
    };
    b.onpointerup = (e) => {
      e.stopPropagation();
      if (moved) {
        scheduleSave();
        renderTabs();
        moved = false;
      } else editClip(c);
    };
  });
}
function renderTabs() {
  $("#edgeTabs").innerHTML = state.paperclips
    .map(
      (c) =>
        `<button class="edge-tab" data-id="${c.id}" style="top:${5 + (c.page / pdf.numPages) * 88}%;background:${c.color}" title="Page ${c.page} · ${esc(c.note || "Paperclip")}" aria-label="Go to page ${c.page}: ${esc(c.note || "Paperclip")}"></button>`,
    )
    .join("");
  $$(".edge-tab").forEach(
    (el) =>
      (el.onclick = () =>
        go(state.paperclips.find((c) => c.id === el.dataset.id).page)),
  );
}
async function thumbnail(n) {
  if (thumbs.has(n)) return thumbs.get(n);
  const p = await pdf.getPage(n),
    vp = p.getViewport({ scale: 0.13 }),
    c = document.createElement("canvas");
  c.width = vp.width;
  c.height = vp.height;
  await p.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
  const url = c.toDataURL("image/webp", 0.65);
  thumbs.set(n, url);
  return url;
}
let filmObserver;
function buildFilm() {
  filmObserver?.disconnect();
  $("#filmstrip").innerHTML = Array.from(
    { length: pdf.numPages },
    (_, i) =>
      `<button class="thumb ${i + 1 === page ? "selected" : ""}" data-page="${i + 1}" aria-label="Page ${i + 1}"><div class="thumb-paper"><img alt="" loading="lazy"><span class="thumb-mark"></span></div><span class="thumb-number">${String(i + 1).padStart(2, "0")}</span></button>`,
  ).join("");
  filmObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        if (e.isIntersecting) {
          const n = +e.target.dataset.page;
          thumbnail(n)
            .then((url) => {
              if (e.target.isConnected) e.target.querySelector("img").src = url;
            })
            .catch(() => {});
          filmObserver.unobserve(e.target);
        }
    },
    { root: $("#filmstrip"), rootMargin: "100px" },
  );
  $$(".thumb").forEach((el) => {
    filmObserver.observe(el);
    el.onclick = () => go(+el.dataset.page);
  });
  updateFilmMarkers();
  $("#filmstrip .selected")?.scrollIntoView({
    block: "nearest",
    inline: "center",
  });
}
function updateFilmMarkers() {
  $$(".thumb").forEach((el) => {
    const n = +el.dataset.page;
    el.querySelector(".thumb-mark").textContent = state.paperclips.some(
      (c) => c.page === n,
    )
      ? "●"
      : state.pageAnnotations[n]?.length
        ? "✦"
        : "";
  });
}
function sound(speed = 1) {
  if (muted) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    sound.ctx ||= new AC();
    const ctx = sound.ctx;
    if (ctx.state === "suspended") ctx.resume();
    const duration = 0.28 + Math.min(1, speed) * 0.18,
      buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(500 + speed * 500, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(
      180,
      ctx.currentTime + duration,
    );
    filter.Q.value = 0.65;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + duration);
  } catch {}
}
function setTool(t) {
  tool = t;
  ["hand", "marker", "eraser"].forEach((id) =>
    $("#" + id).classList.toggle("active", id === t),
  );
  $("#stage").dataset.tool = t;
  if (t === "hand") $("#studio").hidden = true;
  else showStudio();
}
function showStudio() {
  const el = $("#studio");
  el.hidden = false;
  if (tool === "marker") {
    el.innerHTML = `<span class="studio-title">${icon("highlighter")} Marker studio</span><div class="swatches">${["#FFEB3B", "#69F0AE", "#40C4FF", "#FF80AB", "#FFAB40", "#B388FF"].map((c) => `<button class="swatch ${c === brush.color ? "chosen" : ""}" style="background:${c}" data-color="${c}" aria-label="Marker color ${c}"></button>`).join("")}<label class="custom-color" title="Custom color"><input id="customColor" type="color" value="${brush.color}" aria-label="Custom marker color">${icon("plus")}</label></div><label>Size <select id="brushSize"><option value="8">Fine · 8</option><option value="18">Medium · 18</option><option value="32">Broad · 32</option><option value="custom">Custom</option></select></label><input id="brushWidth" type="range" min="4" max="60" value="${brush.width}" aria-label="Brush width"><label>Ink <input id="opacity" type="range" min="15" max="70" value="${brush.opacity * 100}"><output id="opacityLabel">${Math.round(brush.opacity * 100)}%</output></label><label class="check"><input id="straight" type="checkbox" ${brush.straight ? "checked" : ""}> Straight line</label>${btn("clearInk", "trash-2", "Clear page highlights")}`;
    refreshIcons();
    $$(".swatch").forEach(
      (el) =>
        (el.onclick = () => {
          brush.color = el.dataset.color;
          showStudio();
        }),
    );
    $("#customColor").oninput = (e) => (brush.color = e.target.value);
    $("#brushSize").value = [8, 18, 32].includes(brush.width)
      ? brush.width
      : "custom";
    $("#brushSize").onchange = (e) => {
      if (e.target.value !== "custom") {
        brush.width = +e.target.value;
        $("#brushWidth").value = brush.width;
      }
    };
    $("#brushWidth").oninput = (e) => {
      brush.width = +e.target.value;
      $("#brushSize").value = "custom";
    };
    $("#opacity").oninput = (e) => {
      $("#opacityLabel").textContent = e.target.value + "%";
      brush.opacity = +e.target.value / 100;
    };
    $("#straight").onchange = (e) => (brush.straight = e.target.checked);
  } else {
    el.innerHTML = `<span class="studio-title">${icon("eraser")} Eraser studio</span><button id="pixelMode" class="chip ${eraserMode === "pixel" ? "active" : ""}">Precision pixel</button><button id="strokeMode" class="chip ${eraserMode === "stroke" ? "active" : ""}">Whole stroke</button><label>Diameter <input id="eraserWidth" type="range" min="10" max="80" value="${eraserWidth}"><output id="eraserLabel">${eraserWidth}px</output></label><span class="studio-hint">Only ink is erased. Your PDF stays untouched.</span>${btn("clearInk", "trash-2", "Clear page highlights")}`;
    refreshIcons();
    $("#pixelMode").onclick = () => {
      eraserMode = "pixel";
      showStudio();
    };
    $("#strokeMode").onclick = () => {
      eraserMode = "stroke";
      showStudio();
    };
    $("#eraserWidth").oninput = (e) => {
      eraserWidth = +e.target.value;
      $("#eraserLabel").textContent = eraserWidth + "px";
    };
  }
  el.insertAdjacentHTML(
    "beforeend",
    btn("studioUndo", "undo-2", "Undo stroke") +
      btn("studioRedo", "redo-2", "Redo stroke"),
  );
  $("#studioUndo").onclick = () => ann.undo();
  $("#studioRedo").onclick = () => ann.redo();
  refreshIcons();
  $("#clearInk").onclick = () =>
    confirmDialog(
      "Clear this page’s highlights?",
      "Your PDF and paperclips will stay exactly as they are. You can undo this action.",
      () => ann.clear(),
    );
}
function dialog(title, body, actions = "") {
  const d = $("#dialog");
  d.innerHTML = `<div class="dialog-head"><div><span class="eyebrow">FLIPVAULT PRO</span><h2>${title}</h2></div><button id="closeDialog" class="icon-btn" aria-label="Close dialog">${icon("x")}</button></div><div class="dialog-body">${body}</div>${actions ? `<div class="dialog-actions">${actions}</div>` : ""}`;
  d.showModal();
  $("#closeDialog").onclick = () => d.close();
  refreshIcons();
  return d;
}
function confirmDialog(title, body, fn) {
  const d = dialog(
    title,
    `<p>${body}</p>`,
    `<button id="cancelAction" class="secondary">Keep reading</button><button id="confirmAction" class="primary danger">Clear highlights</button>`,
  );
  $("#cancelAction").onclick = () => d.close();
  $("#confirmAction").onclick = () => {
    fn();
    d.close();
  };
}
function editClip(clip) {
  const editing = !!clip;
  const c = clip || {
    id: crypto.randomUUID(),
    page,
    edge: "top",
    position: 0.78,
    color: clipColor,
    note: "",
  };
  const d = dialog(
    editing ? "A note worth keeping." : "Mark a little moment.",
    `<p class="muted">A physical bookmark for page ${c.page}. Drag it along the page edge to find its perfect place.</p><label class="field-label">CLIP FINISH</label><div class="clip-palette">${[
      ["#b9c6ce", "Silver"],
      ["#d1ac58", "Gold"],
      ["#c64d54", "Crimson"],
      ["#4d79c6", "Royal blue"],
      ["#44886d", "Emerald"],
      ["#9676bd", "Violet"],
    ]
      .map(
        ([color, name]) =>
          `<button data-clip-color="${color}" class="clip-choice ${c.color === color ? "chosen" : ""}" title="${name}">${clipSVG(color)}<span>${name}</span></button>`,
      )
      .join(
        "",
      )}</div><label class="field-label" for="clipEdge">PAGE EDGE</label><select id="clipEdge" class="full-input"><option value="top">Top edge</option><option value="right">Right outer edge</option><option value="bottom">Bottom edge</option></select><label class="field-label" for="clipNote">LABEL / NOTE</label><textarea id="clipNote" rows="3" maxlength="1000" placeholder="A thought, a quote, something to come back to…">${esc(c.note)}</textarea>`,
    ` ${editing ? '<button id="deleteClip" class="secondary danger">Remove clip</button>' : ""}<button id="saveClip" class="primary">${editing ? "Save note" : "Attach paperclip"}</button>`,
  );
  $("#clipEdge").value = c.edge;
  let color = c.color;
  $$("[data-clip-color]").forEach(
    (el) =>
      (el.onclick = () => {
        color = el.dataset.clipColor;
        $$("[data-clip-color]").forEach((e) =>
          e.classList.toggle("chosen", e === el),
        );
      }),
  );
  $("#saveClip").onclick = () => {
    Object.assign(c, {
      color,
      edge: $("#clipEdge").value,
      note: $("#clipNote").value,
    });
    clipColor = color;
    if (!editing) state.paperclips.push(c);
    d.close();
    renderPageClips($("#uiLayer"), page);
    renderTabs();
    updateFilmMarkers();
    scheduleSave();
    toast(editing ? "Note saved." : "A little moment, saved.");
  };
  if (editing)
    $("#deleteClip").onclick = () => {
      state.paperclips = state.paperclips.filter((x) => x.id !== c.id);
      d.close();
      renderPageClips($("#uiLayer"), page);
      renderTabs();
      updateFilmMarkers();
      scheduleSave();
    };
}
function openDrawer(title, subtitle, body) {
  $("#drawer").innerHTML =
    `<div class="drawer-head"><div><span class="eyebrow">YOUR PERSONAL SPACE</span><h2>${title}</h2><p>${subtitle}</p></div>${btn("closeDrawer", "x", "Close panel")}</div><div class="drawer-content">${body}</div>`;
  $("#drawer").hidden = false;
  $("#drawerBackdrop").hidden = false;
  $("#closeDrawer").onclick = closeDrawer;
  refreshIcons();
}
function closeDrawer() {
  $("#drawer").hidden = true;
  $("#drawerBackdrop").hidden = true;
  searchToken++;
}
async function showLibrary() {
  await save();
  const books = await store.all("pdfFiles"),
    states = await store.all("readingState");
  openDrawer(
    "Your library.",
    "Good books deserve a home.",
    `<button id="libraryImport" class="primary full">${icon("plus")} Add a PDF</button><div class="library-grid">${books
      .map((b) => {
        const s = states.find((s) => s.pdfHash === b.pdfHash);
        return `<article class="library-book"><button class="open-book" data-hash="${b.pdfHash}"><img src="${b.cover}" alt="Cover of ${esc(b.title)}"><strong>${esc(b.title)}</strong><span>${b.pageCount} pages · ${Math.round(b.fileSize / 1024)} KB</span><div class="book-progress"><span style="width:${((s?.lastPage || 1) / b.pageCount) * 100}%"></span></div><small>${b.pdfHash === book.pdfHash ? "Currently reading" : `Page ${s?.lastPage || 1} of ${b.pageCount}`}</small></button><button class="remove-book" data-hash="${b.pdfHash}" title="Remove book from device">${icon("trash-2")}</button></article>`;
      })
      .join(
        "",
      )}</div><div class="privacy-card">${icon("shield-check")}<h3>A library that belongs to you.</h3><p>No accounts. No uploads. Your PDFs and annotations never leave this device unless you export them.</p></div>`,
  );
  $("#libraryImport").onclick = () => $("#pdfFile").click();
  $$(".open-book").forEach(
    (el) =>
      (el.onclick = run(async () =>
        openBook(await store.get("pdfFiles", el.dataset.hash)),
      )),
  );
  $$(".remove-book").forEach(
    (el) =>
      (el.onclick = run(async () => {
        if (el.dataset.hash === book.pdfHash) {
          toast("Open another book before removing this one.");
          return;
        }
        if (
          confirm(
            "Remove this PDF from this device? Saved notes will be kept for re-import.",
          )
        ) {
          await store.remove("pdfFiles", el.dataset.hash);
          showLibrary();
        }
      })),
  );
  refreshIcons();
}
function showClips() {
  const clips = [...state.paperclips].sort((a, b) => a.page - b.page);
  const highlights = Object.entries(state.pageAnnotations).filter(([, s]) =>
    s.some((x) => x.tool === "marker"),
  );
  openDrawer(
    "Little things, kept.",
    "Your paperclips, notes & highlighted pages.",
    `<div class="drawer-stat"><strong>${clips.length}</strong><span>paperclips</span><strong>${highlights.length}</strong><span>marked pages</span></div><button id="drawerAddClip" class="secondary full">${icon("plus")} Clip this page</button><div class="notes-list">${clips.map((c) => `<button class="note-card" data-clip="${c.id}"><span class="note-clip">${clipSVG(c.color)}</span><div><small>PAGE ${c.page} · ${c.edge.toUpperCase()} EDGE</small><strong>${esc(c.note || "An important page")}</strong></div>${icon("arrow-up-right")}</button>`).join("") || '<div class="empty-state">No paperclips yet.<br>Keep a thought. Mark a discovery.</div>'}</div><h3 class="section-title">Highlighted pages</h3>${highlights.map(([n, s]) => `<button class="result highlight-result" data-page="${n}">${icon("highlighter")}<span>Page ${n}<small>${s.filter((x) => x.tool === "marker").length} highlight strokes</small></span>${icon("arrow-up-right")}</button>`).join("") || '<p class="muted">Highlight a passage to find it here later.</p>'}`,
  );
  $("#drawerAddClip").onclick = () => editClip();
  $$("[data-clip]").forEach(
    (el) =>
      (el.onclick = async () => {
        const c = state.paperclips.find((c) => c.id === el.dataset.clip);
        await go(c.page);
        editClip(c);
      }),
  );
  $$(".highlight-result").forEach(
    (el) => (el.onclick = () => go(+el.dataset.page)),
  );
  refreshIcons();
}
function showSearch() {
  openDrawer(
    "Find a thought.",
    "Search every word, across your entire book.",
    `<div class="search-box">${icon("search")}<input id="searchInput" placeholder="A word, a phrase, a little idea…" aria-label="Search book text" autofocus></div><div id="searchStatus" class="muted search-status">Type at least 2 characters to search.</div><div id="searchResults"></div>`,
  );
  $("#searchInput").focus();
  let timer;
  $("#searchInput").oninput = () => {
    clearTimeout(timer);
    searchToken++;
    timer = setTimeout(
      () => searchBook($("#searchInput").value.trim()).catch(fail),
      250,
    );
  };
}
async function pageText(n) {
  if (!textCache.has(n)) {
    const p = await pdf.getPage(n),
      content = await p.getTextContent();
    textCache.set(n, content.items.map((i) => i.str).join(" "));
  }
  return textCache.get(n);
}
async function searchBook(query) {
  const token = ++searchToken;
  if (query.length < 2) {
    $("#searchResults").innerHTML = "";
    $("#searchStatus").textContent = "Type at least 2 characters to search.";
    return;
  }
  $("#searchResults").innerHTML = "";
  let matches = 0;
  for (let n = 1; n <= pdf.numPages; n++) {
    if (token !== searchToken) return;
    const text = await pageText(n);
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx >= 0) {
      matches++;
      const start = Math.max(0, idx - 55),
        end = Math.min(text.length, idx + query.length + 90);
      const el = document.createElement("button");
      el.className = "result";
      el.innerHTML = `<span class="result-page">${n}</span><span>${esc(text.slice(start, idx))}<mark>${esc(text.slice(idx, idx + query.length))}</mark>${esc(text.slice(idx + query.length, end))}</span>${icon("arrow-up-right")}`;
      el.onclick = async () => {
        await go(n);
        $("#rightPage").classList.remove("search-pulse");
        void $("#rightPage").offsetWidth;
        $("#rightPage").classList.add("search-pulse");
      };
      $("#searchResults").append(el);
    }
    $("#searchStatus").textContent =
      `${matches} matching pages · searched ${n} / ${pdf.numPages}`;
    if (n % 6 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  refreshIcons();
}
function toggleMenu(id, show) {
  const pop = $("#popover");
  if (!pop.hidden && pop.dataset.owner === id) {
    pop.hidden = true;
    return;
  }
  pop.dataset.owner = id;
  show();
}
function popover(anchor, html) {
  const p = $("#popover");
  p.innerHTML = html;
  p.hidden = false;
  const r = anchor.getBoundingClientRect();
  p.style.top =
    Math.max(12, Math.min(r.bottom + 10, innerHeight - p.offsetHeight - 12)) +
    "px";
  p.style.left = Math.max(12, Math.min(r.left, innerWidth - 275)) + "px";
  refreshIcons();
}
function applyBackground() {
  document.documentElement.dataset.background = background;
  const colors = {
    black: "#000000",
    charcoal: "#141414",
    forest: "#172827",
    parchment: "#29231e",
  };
  document.querySelector('meta[name="theme-color"]').content =
    colors[background];
}
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  $("#theme span").textContent = {
    original: "Original paper",
    sepia: "Warm parchment",
    dark: "AMOLED dark",
    ink: "E-ink contrast",
  }[theme];
}
function showThemes() {
  popover(
    $("#theme"),
    `<span class="menu-label">MAKE YOURSELF COMFORTABLE</span>${[
      ["original", "sun", "Original paper"],
      ["sepia", "coffee", "Warm parchment"],
      ["dark", "moon", "AMOLED dark"],
      ["ink", "contrast", "E-ink contrast"],
    ]
      .map(
        ([id, i, label]) =>
          `<button data-theme="${id}" class="menu-item">${icon(i)}${label}${theme === id ? icon("check") : ""}</button>`,
      )
      .join(
        "",
      )}<hr><span class="menu-label">READER BACKGROUND · PAPER STAYS UNCHANGED</span><div class="background-options">${[
      ["black", "Pure black", "#000000"],
      ["charcoal", "Charcoal", "#141414"],
      ["forest", "Forest", "#172827"],
      ["parchment", "Warm brown", "#29231e"],
    ]
      .map(
        ([id, label, color]) =>
          `<button data-background="${id}" aria-pressed="${background === id}" class="background-choice"><span style="background:${color}"></span>${label}${background === id ? icon("check") : ""}</button>`,
      )
      .join(
        "",
      )}</div><label class="menu-item small"><input id="preserveImages" type="checkbox" ${document.body.classList.contains("preserve-images") ? "checked" : ""}> Preserve images in dark mode</label>`,
  );
  $$("[data-theme]")
    .filter((el) => el.tagName === "BUTTON")
    .forEach(
      (el) =>
        (el.onclick = () => {
          theme = el.dataset.theme;
          applyTheme();
          scheduleSave();
          $("#popover").hidden = true;
        }),
    );
  $$("button[data-background]").forEach(
    (el) =>
      (el.onclick = run(async () => {
        background = el.dataset.background;
        applyBackground();
        await store.put("settings", background, "readerBackground");
        showThemes();
      })),
  );
  $("#preserveImages").onchange = run(async (e) => {
    document.body.classList.toggle("preserve-images", e.target.checked);
    await store.put("settings", e.target.checked, "preserveImages");
    if (e.target.checked)
      toast(
        "Image preservation keeps original page colors on AMOLED surroundings.",
      );
  });
}
function showLayout() {
  popover(
    $("#layout"),
    `<span class="menu-label">READ YOUR WAY</span>${[
      ["auto", "smartphone", "Automatic"],
      ["single", "file", "Single page"],
      ["spread", "book-open", "Book spread"],
    ]
      .map(
        ([m, i, t]) =>
          `<button data-mode="${m}" class="menu-item">${icon(i)}${t}${mode === m ? icon("check") : ""}</button>`,
      )
      .join(
        "",
      )}<hr><label class="menu-item"><input id="rtlToggle" type="checkbox" ${rtl ? "checked" : ""}> Right-to-left / Manga</label>`,
  );
  $$("[data-mode]").forEach(
    (el) =>
      (el.onclick = run(async () => {
        mode = el.dataset.mode;
        cache.clear();
        $("#popover").hidden = true;
        await render();
      })),
  );
  $("#rtlToggle").onchange = (e) => {
    rtl = e.target.checked;
    scheduleSave();
    toast(rtl ? "Manga direction enabled." : "Left-to-right reading enabled.");
  };
}
async function showVault() {
  await save();
  const supported = "showSaveFilePicker" in window;
  const persisted = await navigator.storage?.persisted?.();
  dialog(
    "Your notes, for keeps.",
    `<div class="vault-hero">${icon("shield-check")}<div><strong>Private by design. Backed up by you.</strong><p>Your books stay in this browser. A vault backup keeps your notes safe outside it.</p></div></div><div class="backup-status"><span class="status-dot"></span> Device storage ${persisted ? "protected against automatic eviction" : "active · browser may evict data"}</div><button id="downloadVault" class="option-card">${icon("download")}<span><strong>Download a vault backup</strong><small>All books’ notes, highlights & reading positions · .json</small></span>${icon("arrow-up-right")}</button><button id="restoreVault" class="option-card">${icon("folder-open")}<span><strong>Restore a backup</strong><small>Match notes to your PDFs, even after a browser reset</small></span>${icon("arrow-up-right")}</button>${supported ? `<button id="linkVault" class="option-card">${icon("folder-sync")}<span><strong>${vaultHandle ? "Relink" : "Link"} an auto-sync vault file</strong><small>Automatically write changes to a file on this device</small></span>${icon("arrow-up-right")}</button><button id="openLinkedVault" class="option-card">${icon("file-check")}<span><strong>Open an existing vault file</strong><small>Restore and continue syncing to it</small></span></button>` : '<div class="info-note">Your browser does not support direct file linking. Download a vault backup regularly, and restore it with the button above.</div>'}${store.isNative() ? `<button id="nativeAutoBackup" class="option-card">${icon("folder-sync")}<span><strong>${nativeVaultEnabled ? "Refresh" : "Enable"} Android auto-backup</strong><small>Writes notes to Documents / FlipVault on every change</small></span></button>` : ""}<p class="fine-print">Backups contain annotations, not the original PDFs. Keep your PDF files separately. Clearing all site data deletes browser storage and file permissions; select your backup and re-import your PDFs to recover. File linking must be reauthorized after reopening.</p>`,
  );
  if (store.isNative())
    $("#nativeAutoBackup").onclick = run(async () => {
      await store.syncNativeVault(await store.vaultData());
      nativeVaultEnabled = true;
      await store.put("settings", true, "nativeAutoBackup");
      await save();
      toast("Auto-backup enabled in Documents / FlipVault.");
    });
  $("#downloadVault").onclick = run(async () => {
    await store.download(
      JSON.stringify(await store.vaultData()),
      "FlipVault-" + new Date().toISOString().slice(0, 10) + ".flipvault.json",
    );
    toast("Backup downloaded. Keep it somewhere safe.");
  });
  $("#restoreVault").onclick = () => $("#vaultFile").click();
  if (supported) {
    $("#linkVault").onclick = run(async () => {
      try {
        const handle = await showSaveFilePicker({
          suggestedName: "My Library.flipvault",
          types: [
            {
              description: "FlipVault backup",
              accept: { "application/json": [".flipvault"] },
            },
          ],
        });
        vaultHandle = handle;
        await save();
        $("#dialog").close();
        toast("Vault linked. Your changes will sync automatically.");
      } catch (e) {
        if (e.name !== "AbortError") throw e;
      }
    });
    $("#openLinkedVault").onclick = run(async () => {
      try {
        const [h] = await showOpenFilePicker({
          types: [
            {
              description: "FlipVault backup",
              accept: { "application/json": [".flipvault", ".json"] },
            },
          ],
        });
        const data = JSON.parse(await (await h.getFile()).text());
        await store.restoreVault(data);
        vaultHandle = h;
        state = null;
        await openBook(book);
        $("#dialog").close();
        toast("Vault restored and linked.");
      } catch (e) {
        if (e.name !== "AbortError") throw e;
      }
    });
  }
  refreshIcons();
}
async function exportPDF() {
  await save();
  toast("Preparing your annotated PDF…");
  const out = await PDFDocument.load(book.data.slice(0));
  for (const [n, strokes] of Object.entries(state.pageAnnotations)) {
    if (!strokes.length) continue;
    const p = out.getPage(+n - 1),
      { width, height } = p.getSize(),
      c = document.createElement("canvas");
    c.width = Math.min(1800, Math.ceil(width * 2));
    c.height = Math.ceil((c.width * height) / width);
    const a = new AnnotationEngine(c, () => {});
    a.logicalHeight = (1000 * height) / width;
    a.items = strokes;
    a.render();
    const bytes = await fetch(c.toDataURL("image/png")).then((r) =>
      r.arrayBuffer(),
    );
    const image = await out.embedPng(bytes);
    p.drawImage(image, {
      x: 0,
      y: 0,
      width,
      height,
      blendMode: BlendMode.Multiply,
    });
  }
  for (const c of state.paperclips) {
    const p = out.getPage(c.page - 1),
      size = p.getSize();
    const text = (c.note || "Paperclip")
      .replace(/[^\x20-\x7E]/g, "?")
      .slice(0, 100);
    p.drawText(`[Clip] ${text}`, {
      x: 20,
      y: Math.max(
        16,
        size.height -
          20 -
          state.paperclips.filter((x) => x.page === c.page).indexOf(c) * 14,
      ),
      size: 9,
      maxWidth: size.width - 40,
    });
  }
  await store.download(
    await out.save(),
    book.title + " — annotated.pdf",
    "application/pdf",
  );
  toast("Annotated PDF exported.");
}
async function studySummary() {
  await save();
  const pages = [
    ...new Set([
      ...state.paperclips.map((c) => c.page),
      ...Object.keys(state.pageAnnotations)
        .filter((n) =>
          state.pageAnnotations[n].some((s) => s.tool === "marker"),
        )
        .map(Number),
    ]),
  ].sort((a, b) => a - b);
  if (!pages.length) {
    toast("Add a highlight or paperclip to build your study summary.");
    return;
  }
  toast("Collecting your study pages…");
  const out = await PDFDocument.create();
  for (const n of pages) {
    const c = await composite(n),
      p = out.addPage([c.width * 0.5, c.height * 0.5 + 65]);
    const image = await out.embedPng(
      await fetch(c.toDataURL()).then((r) => r.arrayBuffer()),
    );
    p.drawImage(image, {
      x: 0,
      y: 65,
      width: c.width * 0.5,
      height: c.height * 0.5,
    });
    const notes = state.paperclips
      .filter((c) => c.page === n)
      .map((c) => c.note)
      .filter(Boolean)
      .join(" / ");
    p.drawText(
      ("Page " + n + " | " + (notes || "Highlighted study page"))
        .replace(/[^\x20-\x7E]/g, "?")
        .slice(0, 150),
      { x: 16, y: 30, size: 9, maxWidth: p.getWidth() - 32 },
    );
  }
  await store.download(
    await out.save(),
    book.title + " — study summary.pdf",
    "application/pdf",
  );
  toast("Printable study summary downloaded.");
}
function showExport() {
  popover(
    $("#export"),
    `<span class="menu-label">TAKE YOUR IDEAS WITH YOU</span><button id="exportPDF" class="menu-item">${icon("file-down")}Annotated PDF</button><button id="studyPDF" class="menu-item">${icon("notebook-pen")}Printable study summary</button><button id="exportBackup" class="menu-item">${icon("shield-check")}Vault backup & restore</button>`,
  );
  $("#exportPDF").onclick = run(() => {
    $("#popover").hidden = true;
    return exportPDF();
  });
  $("#studyPDF").onclick = run(() => {
    $("#popover").hidden = true;
    return studySummary();
  });
  $("#exportBackup").onclick = () => {
    $("#popover").hidden = true;
    showVault();
  };
}
async function showReference(n) {
  referencePage = Math.max(1, Math.min(pdf.numPages, n));
  const entry = await getPageCanvas(referencePage, 1);
  $("#reference").hidden = false;
  $("#reference").innerHTML =
    `<div class="reference-head">${icon("panels-left-bottom")}<strong>Keep in view</strong><button id="refPrev" class="icon-btn" aria-label="Previous reference page">${icon("chevron-left")}</button><input id="refInput" aria-label="Reference page" type="number" min="1" max="${pdf.numPages}" value="${referencePage}"><button id="refNext" class="icon-btn" aria-label="Next reference page">${icon("chevron-right")}</button>${btn("closeReference", "x", "Close reference")}</div><canvas id="referenceCanvas"></canvas>`;
  const c = $("#referenceCanvas");
  c.width = entry.canvas.width;
  c.height = entry.canvas.height;
  c.getContext("2d").drawImage(entry.canvas, 0, 0);
  $("#refPrev").onclick = () => showReference(referencePage - 1);
  $("#refNext").onclick = () => showReference(referencePage + 1);
  $("#refInput").onchange = (e) => showReference(+e.target.value);
  $("#closeReference").onclick = () => ($("#reference").hidden = true);
  refreshIcons();
}
function updateReadingStats() {
  const seconds = baseSeconds + Math.floor((Date.now() - sessionStart) / 1000),
    minutes = Math.floor(seconds / 60),
    eta =
      page > 1
        ? Math.round(((seconds / (page - 1)) * (pdf.numPages - page)) / 60)
        : null;
  $("#readingTime").textContent =
    eta === null
      ? "Settle in. There’s no hurry."
      : `${eta} min left in this book`;
  $("#sessionLabel").textContent = focusEnd
    ? `FOCUS · ${Math.max(0, Math.ceil((focusEnd - Date.now()) / 60000))} MIN LEFT`
    : `${minutes} MIN READ · ${Math.round((page / pdf.numPages) * 100)}% COMPLETE`;
  if (focusEnd && Date.now() >= focusEnd) {
    focusEnd = 0;
    toast("A lovely little reading session. Time to rest your eyes.");
    sound(0.3);
  }
}
function showMore() {
  popover(
    $("#more"),
    `<span class="menu-label">A LITTLE MORE POSSIBILITY</span><button id="referenceTool" class="menu-item">${icon("panels-left-bottom")}Reference split view</button><button id="focusTimer" class="menu-item">${icon("timer")}${focusEnd ? "Stop focus timer" : "20-minute reading ritual"}</button><button id="fullscreenTool" class="menu-item">${icon("expand")}Fullscreen</button><button id="installApp" class="menu-item">${icon("smartphone")}Install on your device</button><button id="shortcutsTool" class="menu-item">${icon("keyboard")}Shortcuts & gestures</button>`,
  );
  $("#referenceTool").onclick = () => {
    $("#popover").hidden = true;
    showReference(page);
  };
  $("#focusTimer").onclick = () => {
    focusEnd = focusEnd ? 0 : Date.now() + 20 * 60000;
    updateReadingStats();
    $("#popover").hidden = true;
    toast(
      focusEnd
        ? "Twenty minutes, just you and your book."
        : "Reading timer stopped.",
    );
  };
  $("#fullscreenTool").onclick = run(async () => {
    $("#popover").hidden = true;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  });
  $("#installApp").onclick = async () => {
    if (installEvent) {
      await installEvent.prompt();
      installEvent = null;
    } else
      toast(
        "Android: open your browser menu → Add to home screen → Install app.",
      );
  };
  $("#shortcutsTool").onclick = showHelp;
}
function showHelp() {
  $("#popover").hidden = true;
  dialog(
    "A few quiet shortcuts.",
    `<div class="shortcut-grid">${[
      ["← / →", "Turn a page"],
      ["H", "Highlight marker"],
      ["V", "Read & drag anywhere"],
      ["E", "Precision / stroke eraser"],
      ["Ctrl + Z / Y", "Undo / redo this page"],
      ["Ctrl + F", "Search this book"],
      ["+ / −", "Zoom in / out"],
      ["Escape", "Close panels & focus mode"],
    ]
      .map(([key, desc]) => `<kbd>${key}</kbd><span>${desc}</span>`)
      .join(
        "",
      )}</div><h3>Made for your fingertips.</h3><p>In Read mode, hold and drag anywhere on either page: drag left for the next page, right for the previous (reversed in Manga mode). A horizontal movement starts the peel; simply holding still does not turn a page. Short drags spring back. Edge and corner peels still work. Pinch to zoom, double-tap to enlarge, and drag to pan when zoomed.</p><p>With a marker active, one finger draws. Tap the thin outer edge or swipe with two fingers to turn pages. Pause a marker for 350ms to straighten it. Paperclips slide along their page edge.</p><div class="info-note">For best performance on phones, use single-page mode. FlipVault limits render resolution and keeps only five nearby high-resolution pages in memory.</div>`,
  );
}
const pointers = new Map();
let lastTap = 0,
  zoomTimer;
function annotationPoint(e) {
  const r = $("#rightPage").getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * 1000,
    y: ((e.clientY - r.top) / r.height) * ann.logicalHeight,
  };
}
function curlPoint(e) {
  const r = $("#rightPage").getBoundingClientRect(),
    w = curl.w;
  if (gesture.interior)
    return interiorFoldPoint(
      w,
      curl.h,
      curl.c.y,
      { x: gesture.startX, y: gesture.startY },
      e,
      r,
      gesture.reverse,
    );
  return {
    x:
      (gesture.reverse
        ? 1 - (e.clientX - r.left) / r.width
        : (e.clientX - r.left) / r.width) * w,
    y: ((e.clientY - r.top) / r.height) * curl.h,
  };
}
function pointerSnapshot(e) {
  return { clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId };
}
async function prepareCurl(g) {
  if (g.preparing || g.curl) return;
  if (page + g.dir < 1 || page + g.dir > pdf.numPages) {
    g.blocked = true;
    return;
  }
  g.preparing = true;
  const activePage = page,
    activePdf = pdf;
  try {
    const current = await composite(page),
      next = await composite(page + g.dir);
    if (gesture !== g || pdf !== activePdf || page !== activePage) return;
    if (!pointers.has(g.pointerId) && !g.releaseEvent) return;
    const y = g.anchorY;
    const anchor = g.interior
      ? y * current.height
      : y < 0.22
        ? 0
        : y > 0.78
          ? current.height
          : y * current.height;
    curl.begin(current, next, anchor, g.reverse);
    g.curl = true;
    if (
      g.latest &&
      Math.hypot(g.latest.clientX - g.startX, g.latest.clientY - g.startY) > 0
    )
      curl.move(curlPoint(g.latest));
  } finally {
    g.preparing = false;
  }
  if (gesture === g && g.releaseEvent)
    await pointerEnd(g.releaseEvent, g.canceled);
}
const surface = $("#bookSurface");
surface.addEventListener("contextmenu", (e) => e.preventDefault());
surface.addEventListener(
  "pointerdown",
  run(async (e) => {
    if (
      !ready ||
      turning ||
      e.target.closest("button") ||
      (e.pointerType === "mouse" && e.button !== 0)
    )
      return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    surface.setPointerCapture(e.pointerId);
    if (pointers.size === 2) {
      if (gesture?.drawing) ann.cancel();
      clearTimeout(holdTimer);
      if (curl.running) curl.cancel();
      const pts = [...pointers.values()];
      gesture = {
        pinch: true,
        distance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        zoom,
        startX: (pts[0].x + pts[1].x) / 2,
        lastX: (pts[0].x + pts[1].x) / 2,
      };
      return;
    }
    if (pointers.size > 2) return;
    const r = $("#rightPage").getBoundingClientRect(),
      x = (e.clientX - r.left) / r.width,
      y = (e.clientY - r.top) / r.height;
    const onRight = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    const leftRect = $("#leftPage").getBoundingClientRect();
    const onLeft =
      isSpread() &&
      e.clientX >= leftRect.left &&
      e.clientX <= leftRect.right &&
      e.clientY >= leftRect.top &&
      e.clientY <= leftRect.bottom;
    if (!onRight && !onLeft) {
      gesture = null;
      return;
    }
    const edge = onRight && (x < 0.045 || x > 0.955);
    gesture = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastTime: performance.now(),
      velocity: 0,
      drawing: false,
      edge,
      interior: !edge,
      anchorY: Math.max(0, Math.min(1, y)),
      latest: pointerSnapshot(e),
      leftPage: onLeft ? +$("#leftPage").dataset.page : null,
    };
    if (tool !== "hand" && onRight && !edge) {
      gesture.drawing = true;
      const config =
        tool === "marker"
          ? brush
          : { color: "#000000", width: eraserWidth, opacity: 1 };
      ann.start(
        annotationPoint(e),
        tool === "marker" ? "marker" : eraserMode,
        config,
      );
      holdTimer = setTimeout(() => ann.snap(), 350);
      return;
    }
    if (zoom > 1) {
      gesture.pan = true;
      gesture.scrollX = $("#bookViewport").scrollLeft;
      gesture.scrollY = $("#bookViewport").scrollTop;
      return;
    }
    if (onLeft && tool !== "hand") return;
    if (!edge) {
      gesture.pending = true;
      return;
    }
    gesture.reverse = x < 0.5;
    gesture.dir = (gesture.reverse ? -1 : 1) * (rtl ? -1 : 1);
    await prepareCurl(gesture);
  }),
);
surface.addEventListener("pointermove", (e) => {
  const prev = pointers.get(e.pointerId);
  if (prev) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const cursor = $("#brushCursor"),
    r = $("#rightPage").getBoundingClientRect();
  if (tool !== "hand") {
    const size =
      ((tool === "eraser" ? eraserWidth : brush.width) / 1000) * r.width;
    cursor.style.cssText = `display:block;left:${e.clientX - r.left}px;top:${e.clientY - r.top}px;width:${size}px;height:${size}px`;
  }
  if (!gesture) return;
  if (gesture.pinch && pointers.size === 2) {
    const pts = [...pointers.values()],
      distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    zoom = Math.max(
      1,
      Math.min(4, (gesture.zoom * distance) / gesture.distance),
    );
    surface.style.setProperty("--zoom", zoom);
    $("#bookViewport").classList.toggle("zoomed", zoom > 1);
    $("#zoomValue").textContent = Math.round(zoom * 100) + "%";
    gesture.lastX = (pts[0].x + pts[1].x) / 2;
    return;
  }
  if (gesture.drawing) {
    clearTimeout(holdTimer);
    ann.move(annotationPoint(e));
    holdTimer = setTimeout(() => ann.snap(), 350);
    return;
  }
  if (gesture.pan) {
    $("#bookViewport").scrollLeft =
      gesture.scrollX - (e.clientX - gesture.startX);
    $("#bookViewport").scrollTop =
      gesture.scrollY - (e.clientY - gesture.startY);
    return;
  }
  const g = gesture,
    now = performance.now();
  g.latest = pointerSnapshot(e);
  g.velocity = (e.clientX - g.lastX) / (now - g.lastTime || 1);
  g.lastX = e.clientX;
  g.lastTime = now;
  if (
    (g.pending || g.blocked) &&
    horizontalIntent(e.clientX - g.startX, e.clientY - g.startY)
  ) {
    g.pending = false;
    g.blocked = false;
    g.reverse = e.clientX > g.startX;
    g.dir = (g.reverse ? -1 : 1) * (rtl ? -1 : 1);
    prepareCurl(g).catch((error) => {
      if (gesture === g) gesture = null;
      fail(error);
    });
  }
  if (g.curl) curl.move(curlPoint(e));
});
async function pointerEnd(e, cancel = false) {
  pointers.delete(e.pointerId);
  clearTimeout(holdTimer);
  if (!gesture) return;
  const g = gesture;
  if (g.pinch) {
    if (pointers.size === 0) {
      gesture = null;
      if (Math.abs(g.lastX - g.startX) > 70 && Math.abs(zoom - g.zoom) < 0.12) {
        zoom = g.zoom;
        await go(page + (g.lastX < g.startX ? 1 : -1) * (rtl ? -1 : 1), true);
      } else await render();
    }
    return;
  }
  if (g.preparing) {
    g.releaseEvent = pointerSnapshot(e);
    g.canceled = cancel;
    return;
  }
  gesture = null;
  if (g.drawing) {
    ann.finish();
    return;
  }
  if (g.curl) {
    const distance = Math.hypot(e.clientX - g.startX, e.clientY - g.startY),
      vx =
        (performance.now() - g.lastTime > 90 ? 0 : g.velocity) *
        (g.reverse ? -1 : 1),
      progress = (curl.w - curl.p.x) / (2 * curl.w);
    const complete = completeTurn({
      canceled: cancel,
      interior: g.interior,
      progress,
      velocity: vx,
      distance,
      horizontalDistance: Math.abs(e.clientX - g.startX),
      pageWidth: $("#rightPage").getBoundingClientRect().width,
    });
    turning = true;
    if (complete) sound(Math.abs(vx));
    curl.release(complete, (done) => {
      if (done) page += g.dir;
      render()
        .catch(fail)
        .finally(() => (turning = false));
    });
    return;
  }
  if (cancel) {
    lastTap = 0;
    return;
  }
  if (
    g.leftPage &&
    !g.pan &&
    Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 8
  ) {
    await go(g.leftPage);
    return;
  }
  const now = Date.now();
  if (
    now - lastTap < 300 &&
    Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 8
  )
    setZoom(zoom === 1 ? 2 : 1);
  lastTap =
    Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 8 ? now : 0;
}
surface.addEventListener(
  "pointerup",
  run((e) => pointerEnd(e)),
);
surface.addEventListener(
  "pointercancel",
  run((e) => pointerEnd(e, true)),
);
surface.addEventListener(
  "pointerleave",
  () => ($("#brushCursor").style.display = "none"),
);
async function setZoom(z) {
  zoom = Math.max(1, Math.min(4, z));
  surface.style.setProperty("--zoom", zoom);
  $("#bookViewport").classList.toggle("zoomed", zoom > 1);
  $("#zoomValue").textContent = Math.round(zoom * 100) + "%";
  clearTimeout(zoomTimer);
  zoomTimer = setTimeout(() => render().catch(fail), 180);
}
$("#bookViewport").addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(zoom - e.deltaY * 0.005);
    }
  },
  { passive: false },
);
on("exitFocus", () => {
  document.body.classList.remove("focus-mode");
  cache.clear();
  render();
});
on("library", showLibrary);
on("reader", closeDrawer);
on("clips", showClips);
on("search", showSearch);
on("help", showHelp);
on("hand", () => setTool("hand"));
on("marker", () => setTool("marker"));
on("eraser", () => setTool("eraser"));
on("addClip", () => editClip());
on("undo", () => ann.undo());
on("redo", () => ann.redo());
on("theme", () => toggleMenu("theme", showThemes));
on("layout", () => toggleMenu("layout", showLayout));
on("vault", showVault);
on("export", () => toggleMenu("export", showExport));
on("more", () => toggleMenu("more", showMore));
on("import", () => $("#pdfFile").click());
on("prev", () => go(page - (rtl ? -1 : 1), true));
on("next", () => go(page + (rtl ? -1 : 1), true));
on("prevSmall", () => go(page - 1, true));
on("nextSmall", () => go(page + 1, true));
on("first", () => go(1));
on("last", () => go(pdf.numPages));
on("zoomIn", () => setZoom(zoom + 0.25));
on("zoomOut", () => setZoom(zoom - 0.25));
on("zoomValue", () => setZoom(1));
on("sound", () => {
  muted = !muted;
  $("#sound").innerHTML = icon(muted ? "volume-x" : "volume-2");
  refreshIcons();
  toast(muted ? "Page sounds off." : "Page sounds on.");
});
on("focus", () => {
  document.body.classList.toggle("focus-mode");
  fullscreen = document.body.classList.contains("focus-mode");
  $("#focus").innerHTML =
    icon(fullscreen ? "minimize" : "maximize") +
    `<span>${fullscreen ? "Exit focus" : "Focus mode"}</span>`;
  refreshIcons();
  setTimeout(() => {
    cache.clear();
    render().catch(fail);
  }, 240);
});
on("filmToggle", () => {
  $("#filmstrip").hidden = !$("#filmstrip").hidden;
  $("#filmToggle").classList.toggle("active");
  setTimeout(() => {
    cache.clear();
    render().catch(fail);
  }, 100);
});
$("#pageInput").onchange = run((e) => go(+e.target.value));
$("#drawerBackdrop").onclick = closeDrawer;
$("#pdfFile").onchange = run(async (e) => {
  for (const f of e.target.files) await importPDF(f);
  e.target.value = "";
});
$("#vaultFile").onchange = run(async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await save();
  await store.restoreVault(JSON.parse(await file.text()));
  state = null;
  await openBook(book);
  $("#dialog").close();
  toast("Your reading history and notes have been restored.");
  e.target.value = "";
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("#popover,#theme,#layout,#more,#export"))
    $("#popover").hidden = true;
});
document.addEventListener("keydown", (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (e.key === "Escape") {
    closeDrawer();
    $("#popover").hidden = true;
    document.body.classList.remove("focus-mode");
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
    e.preventDefault();
    showSearch();
    return;
  }
  if (typing || $("#dialog").open || !ready) return;
  if (e.ctrlKey || e.metaKey) {
    if (e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey ? ann.redo() : ann.undo();
    }
    if (e.key.toLowerCase() === "y") {
      e.preventDefault();
      ann.redo();
    }
    return;
  }
  const k = e.key.toLowerCase();
  if (k === "arrowright") go(page + (rtl ? -1 : 1), true).catch(fail);
  if (k === "arrowleft") go(page - (rtl ? -1 : 1), true).catch(fail);
  if (k === "h") setTool("marker");
  if (k === "v") setTool("hand");
  if (k === "e") setTool("eraser");
  if (k === "+" || k === "=") setZoom(zoom + 0.25);
  if (k === "-") setZoom(zoom - 0.25);
});
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!pdf) return;
    cache.clear();
    render().catch(fail);
  }, 250);
});
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearTimeout(saveTimer);
    save().catch(fail);
  } else if (state) {
    sessionStart = Date.now();
    baseSeconds = state.totalReadingTimeSeconds || 0;
  }
});
window.addEventListener("pagehide", () => save().catch(() => {}));
setInterval(() => {
  if (ready && !document.hidden) {
    updateReadingStats();
    save().catch(fail);
  }
}, 30000);
// Drop files anywhere without navigating away from the reading room.
window.addEventListener("dragover", (e) => {
  e.preventDefault();
});
window.addEventListener(
  "drop",
  run(async (e) => {
    e.preventDefault();
    for (const f of e.dataTransfer.files)
      if (f.type === "application/pdf" || f.name.endsWith(".pdf"))
        await importPDF(f);
  }),
);
async function init() {
  await store.openDB();
  const savedBackground = await store.get("settings", "readerBackground");
  background = ["black", "charcoal", "forest", "parchment"].includes(
    savedBackground,
  )
    ? savedBackground
    : "black";
  applyBackground();
  document.body.classList.toggle(
    "preserve-images",
    !!(await store.get("settings", "preserveImages")),
  );
  navigator.storage?.persist?.().catch(() => {});
  nativeVaultEnabled =
    store.isNative() && !!(await store.get("settings", "nativeAutoBackup"));
  const active = await store.get("settings", "activePdfHash");
  let b = active ? await store.get("pdfFiles", active) : null;
  if (!b) {
    const books = await store.all("pdfFiles");
    b = books[0];
  }
  if (b) await openBook(b);
  else {
    const data = await makeDemo();
    await importPDF(
      new File([data], "The art of paying attention.pdf", {
        type: "application/pdf",
      }),
    );
  }
  if (import.meta.env.PROD && !store.isNative() && "serviceWorker" in navigator)
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js")
      .catch(() => {});
}
init().catch(fail);

let hudTimer;
function wakeHUD() {
  document.body.classList.remove("hud-idle");
  clearTimeout(hudTimer);
  hudTimer = setTimeout(() => document.body.classList.add("hud-idle"), 3500);
}
document.addEventListener("pointermove", wakeHUD, { passive: true });
document.addEventListener("pointerdown", wakeHUD, { passive: true });
wakeHUD();
