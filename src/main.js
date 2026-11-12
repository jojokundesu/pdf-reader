import { Capacitor } from "@capacitor/core";
import { PageTurnAudio } from "./page-audio";
import pageTurnSoundUrl from "./assets/page-turn.mp3?url";
import { horizontalIntent, interiorFoldPoint, completeTurn } from "./gestures";
import "./style.css";
import {
  createIcons,
  ArrowUpRight,
  Ban,
  BookOpen,
  BookOpenCheck,
  BookOpenText,
  BookmarkPlus,
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
  Expand,
  File as FileIcon,
  FileCheck,
  FileDown,
  FolderOpen,
  FolderSync,
  GalleryHorizontalEnd,
  Highlighter,
  LibraryBig,
  LockKeyhole,
  Maximize,
  Menu,
  MessageSquare,
  Minimize,
  Minus,
  CloudMoon,
  Image as ImageIcon,
  Moon,
  MoonStar,
  MoveHorizontal,
  NotebookPen,
  PanelRightOpen,
  PanelsLeftBottom,
  PanelsTopLeft,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Timer,
  Trash2,
  Type,
  Volume2,
  VolumeX,
  X,
} from "lucide";
const icons = {
  ArrowUpRight,
  Ban,
  BookOpen,
  BookOpenCheck,
  BookOpenText,
  BookmarkPlus,
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
  Expand,
  File: FileIcon,
  FileCheck,
  FileDown,
  FolderOpen,
  FolderSync,
  GalleryHorizontalEnd,
  Highlighter,
  LibraryBig,
  LockKeyhole,
  Maximize,
  Menu,
  MessageSquare,
  Minimize,
  Minus,
  Moon,
  MoonStar,
  CloudMoon,
  Image: ImageIcon,
  MoveHorizontal,
  NotebookPen,
  PanelRightOpen,
  PanelsLeftBottom,
  PanelsTopLeft,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Timer,
  Trash2,
  Type,
  Volume2,
  VolumeX,
  X,
};
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { PDFDocument, rgb } from "pdf-lib";
import * as store from "./storage";
import { PageCurl } from "./curl";
import { makeDemo } from "./demo";
import {
  canonicalPageText,
  findTextMatches,
  rangesForTextMatches,
} from "./text-search.js";
import { lookupWord } from "./dictionary.js";
import {
  EMPTY_LIBRARY,
  artworkFromCanvas,
  newArtwork,
  pickArtwork,
  readArtworkFile,
} from "./backgrounds.js";
import {
  mergeRects,
  relativeRects,
  selectionText,
  wordBounds,
} from "./text-selection.js";
const supportedBookExtensions = new Set([
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
const supportsBook = (name) =>
  supportedBookExtensions.has(name.split(".").pop()?.toLowerCase());
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
  searchHits = [],
  activeSearchHit = -1,
  searchQuery = "",
  selectionSnapshot = { text: "", page: 0, rect: null },
  selectionRange = null,
  selecting = false,
  highlightColor = "#FFE066",
  searchRects = new Map(),
  installEvent,
  fullscreen = false;
let artwork = { ...EMPTY_LIBRARY },
  artworkShown = { home: null, reader: null };
let clipColor = "#b9c6ce",
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
<aside class="rail"><a class="brand" href="#" aria-label="FlipVault home">${icon("book-open")}</a><div class="rail-group">${btn("library", "library-big", "Your library")}${btn("reader", "book-open-text", "Reading room", "active")}${btn("clips", "paperclip", "Paperclips, notes & highlights")}${btn("search", "search", "Search this book")}</div><div class="rail-bottom">${btn("help", "circle-help", "Help & getting started")}<span class="avatar">Y</span></div></aside>
<div class="shell"><header class="topbar hud"><button id="homeBrand" class="wordmark" aria-label="Go to my library">FlipVault <span>PRO</span></button><div class="breadcrumb"><button id="crumbHome" class="crumb-home">My library</button>${icon("chevron-right")}<strong id="bookTitle">Welcome</strong></div><div class="top-actions">${btn("focusSearch", "search", "Find in this book", "icon-btn top-icon")}${btn("focusTools", "sliders-horizontal", "Reader tools", "icon-btn top-icon")}${btn("exitFocus", "minimize", "Exit focus mode", "icon-btn top-icon")}<button id="vault" class="vault-pill">${icon("shield-check")}<span>Saved on device</span><b></b></button>${btn("import", "plus", "Import a book", "import-btn")}</div></header>
<main><section id="home" class="home" aria-label="Your library"><div class="home-hero"><div><div class="eyebrow">YOUR READING ROOM</div><h1>A little less noise. A little more book.</h1><p class="home-sub">Everything you read and mark stays on this device.</p></div><div class="home-hero-actions"><button id="homeImport" class="primary home-import">${icon("plus")}<span>Add a book</span></button><button id="homeBackup" class="secondary home-backup">${icon("shield-check")}<span>Back up reading data</span></button></div></div><div id="homeContinue" class="home-continue" hidden></div><div class="home-head-row"><h2 class="home-title">Your books</h2><span id="homeCount" class="home-count"></span></div><div id="homeGrid" class="home-grid"></div></section>
<div class="workspace-header hud"><div><div class="eyebrow">YOUR READING ROOM</div><h1>A little less noise. A little more book.</h1></div><button id="focus" class="subtle">${icon("maximize")}<span>Focus mode</span></button></div>
<div class="reader-toolbar hud"><div class="toolbar-group"><button id="layout" class="text-btn">${icon("panels-top-left")}<span>Auto spread</span>${icon("chevron-down")}</button><span class="divider"></span><button id="theme" class="text-btn">${icon("sun")}<span>Original paper</span>${icon("chevron-down")}</button></div><div class="toolbar-group"><span class="tool-label">TOOLS</span>${btn("addClip", "paperclip", "Attach a paperclip")}</div></div>
<section id="stage" class="stage" aria-label="Interactive book reader"><div class="stage-ambient"></div><div id="bookViewport" class="book-viewport"><div id="bookSurface" class="book-surface"><div id="leftPage" class="page left-page"><canvas id="leftPdf"></canvas><div id="leftHighlightLayer" class="text-highlight-layer" aria-hidden="true"></div><div id="leftSearchLayer" class="search-layer" aria-hidden="true"></div><div id="leftTextLayer" class="text-layer" aria-label="Selectable page text"></div><div id="leftSelectionLayer" class="selection-layer" aria-hidden="true"></div><div id="leftUI" class="page-ui"></div></div><div id="rightPage" class="page right-page"><canvas id="pdfCanvas"></canvas><div id="highlightLayer" class="text-highlight-layer"></div><div id="searchLayer" class="search-layer" aria-hidden="true"></div><div id="textLayer" class="text-layer" aria-label="Selectable page text"></div><div id="selectionLayer" class="selection-layer" aria-hidden="true"></div><div id="uiLayer" class="page-ui"></div></div><div id="edgeTabs" class="edge-tabs"></div><canvas id="curlCanvas"></canvas></div></div><div id="loading" class="loading" hidden><span class="spinner"></span><span>Preparing your pages…</span></div><div class="stage-caption hud"><span>${icon("move-horizontal")} Hold & drag anywhere to turn the page</span><span id="readingTime">A little time, well spent.</span></div></section>
<footer class="bottom-panel hud"><div class="page-controls"><div class="progress-copy"><span id="progressLabel">YOUR PROGRESS</span><strong id="progressPercent">0%</strong></div><div class="pagination">${btn("first", "chevrons-left", "First page")}${btn("prevSmall", "chevron-left", "Previous page")}<label class="page-input"><input id="pageInput" type="number" min="1" value="1" aria-label="Go to page"><span id="pageTotal">/ 12</span></label>${btn("nextSmall", "chevron-right", "Next page")}${btn("last", "chevrons-right", "Last page")}</div><div class="footer-actions">${btn("sound", "volume-2", "Toggle page sound")}${btn("filmToggle", "gallery-horizontal-end", "Toggle page thumbnails", "active")}${btn("export", "download", "Export & study summary")}</div></div><div id="filmstrip" class="filmstrip" aria-label="Page thumbnails"></div><div class="footer-note"><span>${icon("lock-keyhole")} Your books. Your notes. Only on your device.</span><span id="sessionLabel">MADE FOR SLOW READING</span></div></footer>
</main></div><div id="drawerBackdrop" class="drawer-backdrop" hidden></div><aside id="drawer" class="drawer" hidden></aside><div id="popover" class="popover" hidden></div><section id="focusPanel" class="focus-tools-panel" aria-label="Reader tools" hidden></section><button id="resumeDialog" class="resume-popup" hidden>${icon("message-square")}<span>Resume dialog</span></button><button id="resumeDrawer" class="resume-popup resume-drawer" hidden>${icon("panel-right-open")}<span>Resume panel</span></button><button id="resumePopover" class="resume-popup resume-menu" hidden>${icon("menu")}<span>Resume menu</span></button><button id="resumeReference" class="resume-popup resume-reference" hidden>${icon("panels-left-bottom")}<span>Resume reference</span></button><div id="toast" class="toast" role="status" hidden></div><section id="readerSearch" class="reader-search" role="search" aria-label="Search this book" hidden><button id="closeSearch" class="search-close" aria-label="Close search">${icon("x")}</button><input id="searchInput" type="search" enterkeyhint="search" placeholder="Find in this document" aria-label="Find in this document" autocomplete="off"><span id="searchStatus" class="search-status" aria-live="polite">0 of 0</span><button id="previousSearchHit" aria-label="Previous match">${icon("chevron-left")}</button><button id="nextSearchHit" aria-label="Next match">${icon("chevron-right")}</button><button id="selectSearchHit" aria-label="Actions for current match" title="Select this match for copy, highlight or meaning" disabled>⋯</button></section><div id="selectionActions" class="selection-actions" role="toolbar" aria-label="Selected text actions" hidden><span id="selectionCount">Selected text</span><button id="copySelection">Copy</button><button id="highlightSelection">Highlight</button><button id="meaningSelection">Meaning</button><button id="translateSelection">Translate</button><button id="commentSelection">Comment</button><button id="moreSelection" aria-expanded="false">More</button><button id="clearSelection" aria-label="Dismiss selection actions">×</button></div><div id="selectionMenu" class="selection-menu" hidden><button id="selectAllSelection">Select all on page</button><button id="shareSelection">Share selection</button><div class="highlight-colors" role="group" aria-label="Highlight colour"></div></div><input id="pdfFile" type="file" accept=".pdf,.epub,.mobi,.azw,.azw3,.cbz,.cbr,.djvu,.djv,.txt,.html,.htm,application/pdf,application/epub+zip,text/plain,text/html" multiple hidden><input id="vaultFile" type="file" accept=".json,.flipvault,application/json" hidden><input id="artworkFile" type="file" accept="image/jpeg,image/png,image/webp" hidden><input id="artworkPdf" type="file" accept=".pdf,application/pdf" hidden><dialog id="dialog"></dialog><div id="reference" class="reference" hidden></div>`;
function refreshIcons() {
  createIcons({ icons, attrs: { "stroke-width": 1.65 } });
}
refreshIcons();
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
    textHighlights: {},
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
let lastScheduledPage = 0;
function scheduleSave(delay = null) {
  clearTimeout(saveTimer);
  $("#vault span").textContent = "Saving…";
  // A page turn is the one thing a reader expects to survive an immediate
  // reload, so persist it almost at once; everything else can wait.
  if (delay == null) delay = page === lastScheduledPage ? 350 : 60;
  lastScheduledPage = page;
  saveTimer = setTimeout(() => save().catch(fail), Math.max(0, delay));
}
async function importPDF(file, { open = true } = {}) {
  $("#loading").hidden = false;
  $("#loading span:last-child").textContent =
    `Reading ${file.name} on this device…`;
  try {
    const sourceData = await file.arrayBuffer();
    const hash = await store.fingerprint(sourceData);
    const format = file.name.split(".").pop()?.toLowerCase();
    const imported =
      format === "pdf"
        ? { data: sourceData, title: file.name.replace(/\.pdf$/i, ""), format }
        : await import("./importers").then(({ importBook }) =>
            importBook(file, sourceData),
          );
    const buffer =
      imported.data instanceof ArrayBuffer
        ? imported.data
        : imported.data.buffer.slice(
            imported.data.byteOffset,
            imported.data.byteOffset + imported.data.byteLength,
          );
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
        title: imported.title || file.name.replace(/\.[^.]+$/, ""),
        sourceName: file.name,
        sourceFormat: imported.format || "pdf",
        pageCount: doc.numPages,
        fileSize: file.size,
        cover: c.toDataURL("image/webp", 0.7),
        importedAt: Date.now(),
      };
      await doc.destroy();
      await store.put("pdfFiles", existing);
    }
    if (open) await openBook(existing);
    else await renderHome();
    toast(
      imported.format === "pdf"
        ? "Your book is ready. Make yourself at home."
        : `${file.name} is ready for offline reading.`,
    );
  } finally {
    $("#loading").hidden = true;
  }
}
async function openBook(b) {
  if (state) await save();
  renderToken++;
  if (pdf) await pdf.destroy();
  cache.clear();
  thumbs.clear();
  textCache.clear();
  pageRenders.clear();
  book = b;
  pdf = await pdfjs.getDocument({ ...pdfOptions, data: b.data.slice(0) })
    .promise;
  state = (await store.get("readingState", b.pdfHash)) || getState(b.pdfHash);
  state.textHighlights ??= {};
  page = Math.max(1, Math.min(pdf.numPages, state.lastPage));
  zoom = state.zoomLevel || 1;
  mode = state.readingMode || "auto";
  theme = state.theme || "original";
  rtl = !!state.rtl;
  baseSeconds = state.totalReadingTimeSeconds || 0;
  sessionStart = Date.now();
  rememberReader(b.pdfHash);
  const mobileReader = matchMedia("(max-width: 700px)").matches;
  clearSelection();
  document.body.classList.remove("at-home");
  $("#bookTitle").textContent = b.title;
  if (mobileReader) {
    document.body.classList.add("focus-mode", "focus-filmstrip");
    fullscreen = true;
    autoFocus = true;
    $("#filmstrip").hidden = false;
  }
  $("#pageTotal").textContent = "/ " + pdf.numPages;
  $("#pageInput").max = pdf.numPages;
  applyTheme();
  closeDrawer();
  await render();
  buildFilm();
  // The book is readable the moment its pages and thumbnails exist; the
  // state write that follows must not keep keyboard and touch input locked.
  ready = true;
  await save();
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
const pageRenders = new Map();
function renderTarget(scaleBoost = zoom) {
  const memory = navigator.deviceMemory || 4;
  const mobile = matchMedia("(max-width: 700px)").matches;
  const dprCap = memory <= 2 ? 2 : memory <= 4 || mobile ? 2.35 : 2.75;
  return Math.min(dprCap, devicePixelRatio || 1) * Math.min(scaleBoost, 3);
}
function cached(n, scaleBoost = zoom) {
  const entry = cache.get(n);
  return !!entry && entry.res >= renderTarget(scaleBoost);
}
async function getPageCanvas(n, scaleBoost = zoom) {
  if (n < 1 || n > pdf.numPages) return null;
  const target = renderTarget(scaleBoost),
    key = n;
  const old = cache.get(key);
  if (old && old.res >= target) return old;
  const pending = pageRenders.get(key);
  if (pending && pending.target >= target) return pending.promise;
  const activeDocument = pdf;
  const promise = (async () => {
    const p = await activeDocument.getPage(n),
      v = p.getViewport({ scale: 1 });
    const size = fitSize();
    const memory = navigator.deviceMemory || 4;
    const pixelBudget =
      memory <= 2 ? 4_500_000 : memory <= 4 ? 6_500_000 : 8_500_000;
    const scale = Math.min(
      (target * size.h) / v.height,
      Math.sqrt(pixelBudget / (v.width * v.height)),
      4600 / Math.max(v.width, v.height),
    );
    const vp = p.getViewport({ scale }),
      c = document.createElement("canvas");
    c.width = Math.ceil(vp.width);
    c.height = Math.ceil(vp.height);
    await p.render({
      canvasContext: c.getContext("2d", { alpha: false }),
      viewport: vp,
    }).promise;
    const entry = {
      canvas: c,
      aspect: v.width / v.height,
      res: target,
      pdfWidth: v.width,
      pdfHeight: v.height,
      viewport: vp,
      pdfPage: p,
    };
    if (pdf === activeDocument && Math.abs(n - page) <= 2) {
      const cachedEntry = cache.get(key);
      if (!cachedEntry || cachedEntry.res <= target) cache.set(key, entry);
    }
    return entry;
  })();
  const task = { target, promise };
  pageRenders.set(key, task);
  try {
    return await promise;
  } finally {
    if (pageRenders.get(key) === task) pageRenders.delete(key);
  }
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
function drawTextHighlights(ctx, n, w, h) {
  for (const item of state?.textHighlights?.[n] || []) {
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = item.color;
    for (const rect of item.rects || [])
      ctx.fillRect(rect.x * w, rect.y * h, rect.w * w, rect.h * h);
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
  drawTextHighlights(ctx, n, c.width, c.height);
  drawClips(ctx, n, c.width, c.height);
  return c;
}
const activeTextLayers = new WeakMap();

function visibleLayers() {
  const pairs = [
    { page: Number($("#rightPage").dataset.page) || page, text: $("#textLayer"), search: $("#searchLayer"), selection: $("#selectionLayer"), highlights: $("#highlightLayer") },
  ];
  if (!$("#leftPage").hidden)
    pairs.unshift({
      page: Number($("#leftPage").dataset.page) || Math.max(1, page - 1),
      text: $("#leftTextLayer"),
      search: $("#leftSearchLayer"),
      selection: $("#leftSelectionLayer"),
      highlights: $("#leftHighlightLayer"),
    });
  return pairs;
}

function pageElement(layer) {
  return layer?.closest(".page") || null;
}

function projectRects(overlay, rects, className, dataset) {
  if (!overlay) return [];
  const nodes = [];
  for (const rect of rects) {
    const div = document.createElement("div");
    div.className = className;
    if (dataset) for (const [key, value] of Object.entries(dataset)) div.dataset[key] = value;
    div.style.left = `${rect.x * 100}%`;
    div.style.top = `${rect.y * 100}%`;
    div.style.width = `${rect.w * 100}%`;
    div.style.height = `${rect.h * 100}%`;
    overlay.append(div);
    nodes.push(div);
  }
  return nodes;
}

// --- text layer ---------------------------------------------------------
// pdf.js sizes its spans with --scale-factor and multiplies the viewport
// scale by devicePixelRatio internally. Handing it the device-scale viewport
// stretches every span horizontally, which is why search hits and selections
// used to appear away from the words they belonged to.
async function renderTextLayer(n, entry, container) {
  const token = (activeTextLayers.get(container) || 0) + 1;
  activeTextLayers.set(container, token);
  container.replaceChildren();
  container.dataset.page = n;
  const baseViewport = entry.pdfPage.getViewport({ scale: 1 });
  const page = pageElement(container);
  const cssWidth = page?.clientWidth || entry.viewport.width;
  const cssScale = cssWidth / baseViewport.width || 1;
  container.style.setProperty("--scale-factor", cssScale);
  try {
    const content = await entry.pdfPage.getTextContent({
      includeMarkedContent: true,
    });
    if (activeTextLayers.get(container) !== token) return;
    const layer = new pdfjs.TextLayer({
      textContentSource: content,
      container,
      viewport: entry.pdfPage.getViewport({ scale: cssScale }),
    });
    await layer.render();
    if (activeTextLayers.get(container) !== token) {
      container.replaceChildren();
      return;
    }
    paintSearchOverlay();
  } catch (error) {
    if (activeTextLayers.get(container) === token) container.replaceChildren();
    console.warn("Page text layer unavailable", error);
  }
}



// --- selection ----------------------------------------------------------
function caretFromPoint(x, y) {
  let range = document.caretRangeFromPoint?.(x, y);
  if (!range) {
    const position = document.caretPositionFromPoint?.(x, y);
    if (position) {
      range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
    }
  }
  if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;
  return range;
}

function wordRangeAt(node, offset) {
  const bounds = wordBounds(node.nodeValue, offset);
  if (!bounds) return null;
  const range = document.createRange();
  range.setStart(node, bounds.start);
  range.setEnd(node, bounds.end);
  return range;
}

function usefulRange(range) {
  return range && selectionText(range) ? range : null;
}

// Taps can land on the whitespace pdf.js leaves between words; in that case
// fall back to the surrounding line so a press always produces something the
// reader can highlight, copy or look up.
function nearestTextRange(node, offset) {
  const element =
    node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  const span = element?.closest?.("span");
  if (!span) return null;
  const line = document.createRange();
  line.selectNodeContents(span);
  return usefulRange(line);
}

function textRangeOfSpan(span) {
  if (!span) return null;
  const range = document.createRange();
  range.selectNodeContents(span);
  return usefulRange(range);
}

// Some text layers put a single space or line-break in its own span, and a
// press can land exactly on it. Rather than losing the press, grab the nearest
// span that actually carries words.
function nearbyTextRange(layer, x, y) {
  if (!layer) return null;
  const hit = document.elementFromPoint?.(x, y)?.closest?.("span");
  if (hit && layer.contains(hit)) {
    const direct = textRangeOfSpan(hit);
    if (direct) return direct;
    for (let node = hit.previousElementSibling; node; node = node.previousElementSibling) {
      const range = textRangeOfSpan(node);
      if (range) return range;
    }
    for (let node = hit.nextElementSibling; node; node = node.nextElementSibling) {
      const range = textRangeOfSpan(node);
      if (range) return range;
    }
  }
  let best = null,
    bestDistance = Infinity;
  for (const candidate of layer.querySelectorAll("span")) {
    const rect = candidate.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const distance =
      Math.abs(rect.top + rect.height / 2 - y) * 4 + Math.abs(rect.left - x);
    if (distance >= bestDistance) continue;
    const range = textRangeOfSpan(candidate);
    if (!range) continue;
    bestDistance = distance;
    best = range;
  }
  return best;
}

// A selection may start on a text node (word/sentence) or on the layer
// element itself (select-all), so resolve the owning text layer either way.
function layerForNode(node) {
  const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return element?.closest?.(".text-layer") || null;
}

// The single word under a point, falling back to the surrounding line when
// the point sits in the gap between words.
function wordRangeAtPoint(x, y) {
  const caret = caretFromPoint(x, y);
  if (caret) {
    const range = usefulRange(
      wordRangeAt(caret.startContainer, caret.startOffset),
    );
    if (range) return range;
    const layer = layerForNode(caret.startContainer);
    const near = nearbyTextRange(layer, x, y);
    if (near) return near;
  }
  for (const layer of [$("#rightPage"), $("#leftPage")]) {
    const textLayer = layer?.querySelector(".text-layer");
    if (!textLayer) continue;
    const box = textLayer.getBoundingClientRect();
    if (x < box.left || x > box.right || y < box.top || y > box.bottom) continue;
    const near = nearbyTextRange(textLayer, x, y);
    if (near) return near;
  }
  return null;
}

function paintSelection() {
  for (const entry of visibleLayers()) entry.selection.replaceChildren();
  if (!selectionRange) return;
  const layer = selectionLayerFor(selectionRange);
  const pageEl = pageElement(layer);
  if (!pageEl) return;
  const overlay = layer.id === "leftTextLayer" ? $("#leftSelectionLayer") : $("#selectionLayer");
  projectRects(
    overlay,
    mergeRects(relativeRects(selectionRange.getClientRects(), pageEl.getBoundingClientRect())),
    "selection-rect",
  );
}

function selectionLayerFor(range) {
  return layerForNode(range?.startContainer);
}

function clearSelection() {
  selectionRange = null;
  selecting = null;
  selectionSnapshot = { text: "", page: 0, rect: null };
  if ($("#selectionActions")) {
    $("#selectionActions").hidden = true;
    $("#selectionMenu").hidden = true;
    $("#moreSelection").setAttribute("aria-expanded", "false");
    $("#selectionCount").textContent = "Selected text";
  }
  for (const entry of visibleLayers()) entry.selection.replaceChildren();
}

function selectedPageText() {
  return selectionText(selectionRange);
}

function updateSelectionActions(reposition = true) {
  const text = selectedPageText();
  const actions = $("#selectionActions"),
    menu = $("#selectionMenu");
  if (!text || !selectionRange) {
    actions.hidden = true;
    menu.hidden = true;
    return;
  }
  const layer = selectionLayerFor(selectionRange);
  const pageEl = pageElement(layer);
  const box = pageEl?.getBoundingClientRect();
  const rect = selectionRange.getBoundingClientRect();
  selectionSnapshot = {
    text,
    page: Number(layer?.dataset.page) || page,
    rect: {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    },
    box: box
      ? { left: box.left, top: box.top, width: box.width, height: box.height }
      : null,
  };
  const words = text.split(/\s+/).filter(Boolean).length;
  $("#selectionCount").textContent = `${words}w · ${text.length}c`;
  $("#selectionCount").setAttribute(
    "aria-label",
    `${words} word${words === 1 ? "" : "s"} selected`,
  );
  $("#selectionCount").title = text;
  actions.hidden = false;
  if (!reposition) return;
  // Measure after the bar is visible so it can be clamped to the screen.
  const width = actions.offsetWidth || 280,
    height = actions.offsetHeight || 44;
  const left = Math.max(8, Math.min(innerWidth - width - 8, rect.left + rect.width / 2 - width / 2));
  const above = rect.top - height - 12;
  const top = above > 64 ? above : Math.min(innerHeight - height - 8, rect.bottom + 12);
  actions.style.left = `${left}px`;
  actions.style.top = `${Math.max(64, top)}px`;
  if (!menu.hidden) {
    menu.style.left = `${left}px`;
    menu.style.top = `${Math.max(8, Math.min(innerHeight - menu.offsetHeight - 8, actions.getBoundingClientRect().bottom + 6))}px`;
  }
}

// --- press-and-drag selection -------------------------------------------
// One gesture, the one every other PDF reader uses: press and hold on a
// word to select it, then keep dragging to extend the selection word by
// word. There is no separate "select mode", and no tap counting.
const HOLD_MS = 380;
let hold = null;

function clearHold() {
  if (hold?.timer) clearTimeout(hold.timer);
  hold = null;
}

function beginSelectionAt(x, y, pointerId) {
  const range = wordRangeAtPoint(x, y);
  const layer = layerForNode(range?.startContainer);
  if (!range || !layer) return false;
  gesture = null;
  clearTimeout(holdTimer);
  if (curl.running) curl.cancel();
  selecting = {
    pointerId,
    layer,
    anchor: {
      node: range.startContainer,
      offset: range.startOffset,
      range: range.cloneRange(),
    },
  };
  selectionRange = range;
  paintSelection();
  updateSelectionActions();
  navigator.vibrate?.(12);
  return true;
}

// Grow or shrink the highlight from the word the press started on to the
// word currently under the finger, so the selection always follows the drag.
function extendSelectionTo(x, y) {
  if (!selecting) return;
  const caret = caretFromPoint(x, y);
  if (!caret) return;
  const layer = layerForNode(caret.startContainer);
  if (!layer || layer !== selecting.layer) return;
  const word = wordRangeAt(caret.startContainer, caret.startOffset);
  if (!word) return;
  const anchor = selecting.anchor.range;
  const range = document.createRange();
  const startsBefore =
    word.compareBoundaryPoints(Range.START_TO_START, anchor) < 0;
  const endsAfter = word.compareBoundaryPoints(Range.END_TO_END, anchor) > 0;
  if (startsBefore) {
    range.setStart(word.startContainer, word.startOffset);
    range.setEnd(anchor.endContainer, anchor.endOffset);
  } else if (endsAfter) {
    range.setStart(anchor.startContainer, anchor.startOffset);
    range.setEnd(word.endContainer, word.endOffset);
  } else {
    range.setStart(anchor.startContainer, anchor.startOffset);
    range.setEnd(anchor.endContainer, anchor.endOffset);
  }
  if (!selectionText(range)) return;
  selectionRange = range;
  paintSelection();
  updateSelectionActions(false);
}

function finishSelection() {
  if (!selecting) return false;
  selecting = null;
  clearHold();
  updateSelectionActions();
  return true;
}

function selectAllVisiblePageText() {
  const layer = selectionLayerFor(selectionRange) || $("#textLayer");
  if (!layer?.textContent.trim()) return;
  const range = document.createRange();
  range.selectNodeContents(layer);
  selectionRange = range;
  $("#selectionMenu").hidden = true;
  $("#moreSelection").setAttribute("aria-expanded", "false");
  paintSelection();
  updateSelectionActions();
}

// --- persistent text highlights ----------------------------------------
function pageHighlights(n) {
  return state?.textHighlights?.[n] || [];
}

function renderHighlightOverlays() {
  if (!state) return;
  for (const entry of visibleLayers()) {
    entry.highlights.replaceChildren();
    const items = pageHighlights(entry.page);
    if (!items.length) continue;
    for (const item of items) {
      for (const rect of item.rects || []) {
        const div = document.createElement("div");
        div.className = "text-highlight";
        div.style.left = `${rect.x * 100}%`;
        div.style.top = `${rect.y * 100}%`;
        div.style.width = `${rect.w * 100}%`;
        div.style.height = `${rect.h * 100}%`;
        div.style.setProperty("--mark", item.color);
        div.dataset.highlight = item.id;
        div.title = item.text;
        entry.highlights.append(div);
      }
    }
  }
}

function openHighlight(item, pageNumber) {
  const d = dialog(
    "Highlight",
    `<p class="selected-quote">“${esc(item.text.slice(0, 400))}${item.text.length > 400 ? "…" : ""}”</p><p class="muted">Page ${pageNumber} · saved on this device</p>`,
    `<button id="closeHighlight" class="secondary">Keep reading</button><button id="removeHighlight" class="primary danger">Remove highlight</button>`,
  );
  $("#closeHighlight").onclick = () => d.close();
  $("#removeHighlight").onclick = run(async () => {
    state.textHighlights[pageNumber] = pageHighlights(pageNumber).filter(
      (h) => h.id !== item.id,
    );
    if (!state.textHighlights[pageNumber].length)
      delete state.textHighlights[pageNumber];
    d.close();
    await save();
    renderHighlightOverlays();
    toast("Highlight removed.");
  });
}

async function highlightSelection() {
  const text = selectedPageText();
  if (!text || !selectionRange) return;
  const layer = selectionLayerFor(selectionRange);
  const pageEl = pageElement(layer);
  const pageNumber = Number(layer?.dataset.page) || page;
  if (!pageEl) return;
  const rects = mergeRects(
    relativeRects(selectionRange.getClientRects(), pageEl.getBoundingClientRect()),
  );
  if (!rects.length) return;
  state.textHighlights ??= {};
  state.textHighlights[pageNumber] ??= [];
  state.textHighlights[pageNumber].push({
    id: `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    color: highlightColor,
    text,
    rects,
    createdAt: Date.now(),
  });
  await save();
  renderHighlightOverlays();
  updateFilmMarkers();
  clearSelection();
  closeSelectionMenus();
  toast("Highlight saved. Tap it any time to remove it.");
}

function closeSelectionMenus() {
  $("#selectionMenu").hidden = true;
  $("#moreSelection").setAttribute("aria-expanded", "false");
}

// Clicking a saved highlight explains it and offers removal.
for (const layer of [$("#highlightLayer"), $("#leftHighlightLayer")]) {
  layer?.addEventListener("click", (event) => {
    const id = event.target.closest("[data-highlight]")?.dataset.highlight;
    if (!id || !state) return;
    for (const [n, items] of Object.entries(state.textHighlights || {})) {
      const item = items.find((entry) => entry.id === id);
      if (item) return openHighlight(item, Number(n));
    }
  });
}

// --- search painting ----------------------------------------------------
function clearSearchHighlights() {
  for (const entry of visibleLayers()) entry.search.replaceChildren();
}

function paintSearchOverlay() {
  if (!state) return;
  for (const entry of visibleLayers()) {
    entry.search.replaceChildren();
    if (!searchQuery || !searchHits.length) continue;
    if (!entry.text.childNodes.length) continue;
    const ranges = rangesForTextMatches(entry.text, searchQuery);
    if (!ranges.length) continue;
    const box = pageElement(entry.text)?.getBoundingClientRect();
    if (!box) continue;
    const firstOnPage = searchHits.findIndex((hit) => hit.page === entry.page);
    if (firstOnPage < 0) continue;
    ranges.forEach((match, index) => {
      const rects = mergeRects(
        relativeRects(match.range.getClientRects(), box),
      );
      projectRects(
        entry.search,
        rects,
        `search-rect${firstOnPage + index === activeSearchHit ? " current" : ""}`,
      );
    });
  }
}

async function openExternalUrl(url) {
  if (store.isNative()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
function renderMeaningEntry(entry) {
  const groups = new Map();
  for (const sense of entry.senses) {
    if (!groups.has(sense.p)) groups.set(sense.p, []);
    groups.get(sense.p).push(sense);
  }
  return `<article class="meaning-entry"><h3>${esc(entry.word)}</h3>${[...groups]
    .map(
      ([pos, senses]) =>
        `<div class="meaning-group"><span class="meaning-pos">${esc(pos)}</span><ol>${senses
          .slice(0, 4)
          .map(
            (sense) =>
              `<li><p>${esc(sense.d.replace(/\s*;\s*$/, ""))}</p>${
                sense.s?.length
                  ? `<p class="meaning-syn"><em>Synonyms</em> ${sense.s.map(esc).join(", ")}</p>`
                  : ""
              }${
                sense.e?.length
                  ? `<p class="meaning-example">“${esc(sense.e[0])}”</p>`
                  : ""
              }</li>`,
          )
          .join("")}</ol></div>`,
    )
    .join("")}</article>`;
}

// The dictionary answers for one word at a time: the word the press started
// on, even when the reader has dragged the selection further.
async function showMeaning(selection) {
  const text = String(selection ?? "").trim();
  const word = (text.match(/[\p{L}\p{M}][\p{L}\p{M}_’'-]*/u) || [])[0];
  if (!word) {
    toast("Select an English word to look up.");
    return;
  }
  closeSelectionMenus();
  const d = dialog(
    "Meaning",
    `<p class="selected-quote">“${esc(word)}”</p><p class="muted">Searching the offline dictionary…</p>`,
    `<button id="closeMeaning" class="secondary">Keep reading</button>`,
  );
  $("#closeMeaning").onclick = () => d.close();
  try {
    const { loadDictionaryChunk } = await import("./dictionary-data.js");
    const entry = await lookupWord(word, loadDictionaryChunk);
    if (!d.open) return;
    d.querySelector(".dialog-body").innerHTML = entry
      ? `<div class="meaning-panel">${renderMeaningEntry(entry)}</div><p class="fine-print">Offline WordNet dictionary · English headwords and common inflections.</p>`
      : `<p class="selected-quote">“${esc(word)}”</p><p class="muted">No offline entry for “${esc(word)}”. The dictionary is English-only and skips proper nouns and invented words.</p>`;
    refreshIcons();
  } catch (error) {
    if (d.open)
      d.querySelector(".dialog-body").innerHTML =
        '<p class="muted">The dictionary could not be opened on this device.</p>';
    console.warn("Dictionary unavailable", error);
  }
}
function translateSelection() {
  const text = selectedPageText();
  if (!text) return;
  const d = dialog(
    "Translate selection",
    `<p class="muted">The selected passage will open in Google Translate. Translation requires an internet connection.</p><p class="selected-quote">“${esc(text.slice(0, 500))}${text.length > 500 ? "…" : ""}”</p><label class="field-label" for="translateLanguage">TRANSLATE TO</label><select id="translateLanguage" class="full-input"><option value="en">English</option><option value="hi">Hindi</option><option value="bn">Bengali</option><option value="ta">Tamil</option><option value="te">Telugu</option><option value="ur">Urdu</option><option value="fr">French</option><option value="es">Spanish</option><option value="de">German</option><option value="ja">Japanese</option></select>`,
    `<button id="cancelTranslate" class="secondary">Cancel</button><button id="openTranslate" class="primary">Open Translate</button>`,
  );
  $("#cancelTranslate").onclick = () => d.close();
  $("#openTranslate").onclick = async () => {
    const target = $("#translateLanguage").value;
    d.close();
    await openExternalUrl(
      `https://translate.google.com/?sl=auto&tl=${encodeURIComponent(target)}&text=${encodeURIComponent(text)}`,
    );
  };
}
function commentSelection() {
  const text = selectedPageText();
  if (!text) return;
  const pageNumber = selectionSnapshot.page || page;
  const rect = selectionSnapshot.rect;
  const bounds =
    selectionSnapshot.box ||
    (pageNumber === page ? $("#rightPage") : $("#leftPage")).getBoundingClientRect();
  const position = rect
    ? Math.max(
        0.02,
        Math.min(0.98, (rect.top + rect.height / 2 - bounds.top) / bounds.height),
      )
    : 0.5;
  $("#selectionMenu").hidden = true;
  $("#moreSelection").setAttribute("aria-expanded", "false");
  editClip(null, { page: pageNumber, position, quote: text, isComment: true });
}
async function copySelection() {
  const text = selectedPageText();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    if (!copied)
      throw Error("Your browser did not allow copying this selection.");
  }
  toast("Selected passage copied.");
}
async function shareSelection() {
  const text = selectedPageText();
  if (!text) return;
  if (!navigator.share) {
    await copySelection();
    toast("Sharing is not available here, so the passage was copied instead.");
    return;
  }
  try {
    await navigator.share({
      title: book?.title || "A passage from FlipVault Pro",
      text,
    });
  } catch (error) {
    if (error.name !== "AbortError") throw error;
  }
}
$("#copySelection").onclick = run(copySelection);
$("#translateSelection").onclick = translateSelection;
$("#commentSelection").onclick = commentSelection;
$("#highlightSelection").onclick = run(highlightSelection);
$("#meaningSelection").onclick = () => {
  const text = selectedPageText();
  if (text) showMeaning(text);
};
const highlightPalette = ["#FFE066", "#A5E887", "#9ED8FF", "#FFB3D1"];
function paintHighlightPalette() {
  const holder = $(".highlight-colors");
  if (!holder) return;
  holder.innerHTML = highlightPalette
    .map(
      (color) =>
        `<button class="highlight-swatch${color === highlightColor ? " chosen" : ""}" data-highlight-color="${color}" style="background:${color}" aria-label="Highlight colour ${color}"></button>`,
    )
    .join("");
  holder.querySelectorAll("[data-highlight-color]").forEach(
    (button) =>
      (button.onclick = () => {
        highlightColor = button.dataset.highlightColor;
        paintHighlightPalette();
      }),
  );
}
paintHighlightPalette();
$("#moreSelection").onclick = () => {
  const menu = $("#selectionMenu");
  menu.hidden = !menu.hidden;
  $("#moreSelection").setAttribute("aria-expanded", String(!menu.hidden));
  if (!menu.hidden) {
    const actions = $("#selectionActions").getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, actions.left + actions.width - menu.offsetWidth))}px`;
    menu.style.top = `${Math.min(innerHeight - menu.offsetHeight - 8, actions.bottom + 6)}px`;
  }
};
$("#selectAllSelection").onclick = selectAllVisiblePageText;
$("#shareSelection").onclick = run(shareSelection);
$("#clearSelection").onclick = () => {
  clearSelection();
  closeSelectionMenus();
};
document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest("#selectionActions,#selectionMenu")) {
    $("#selectionMenu").hidden = true;
    $("#moreSelection").setAttribute("aria-expanded", "false");
  }
});

async function render() {
  if (!pdf) return;
  const token = ++renderToken;
  // Only dim the stage when a page actually has to be rasterised; turning to
  // an already rendered page must not flash the loading veil.
  if (!cached(page)) $("#loading").hidden = false;
  try {
    await paintPages(token);
  } catch (error) {
    if (token === renderToken) fail(error);
  } finally {
    // A superseded or failed render must never leave the veil covering the
    // page: that veils intercepts every tap and looks like a frozen app.
    if (token === renderToken) $("#loading").hidden = true;
  }
}

async function paintPages(token) {
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
  $("#rightPage").dataset.page = page;
  await renderTextLayer(page, entry, $("#textLayer"));
  $("#leftPage").hidden = !spread;
  if (spread) {
    const leftNum = page > 1 ? page - 1 : Math.min(2, pdf.numPages);
    const left = await getPageCanvas(leftNum);
    if (token !== renderToken) return;
    const lc = $("#leftPdf");
    lc.width = left.canvas.width;
    lc.height = left.canvas.height;
    lc.getContext("2d").drawImage(left.canvas, 0, 0);
    renderPageClips($("#leftUI"), leftNum);
    await renderTextLayer(leftNum, left, $("#leftTextLayer"));
    $("#leftPage").dataset.page = leftNum;
  }
  renderPageClips($("#uiLayer"), page);
  renderTabs();
  $("#pageInput").value = page;
  $("#progressPercent").textContent =
    Math.round((page / pdf.numPages) * 100) + "%";
  $("#layout span").textContent =
    mode === "auto"
      ? "Auto spread"
      : mode === "spread"
        ? "Book spread"
        : "Single page";
  $$(".thumb").forEach((el) =>
    el.classList.toggle("selected", +el.dataset.page === page),
  );
  centerFilmOnPage();
  cache.forEach((v, n) => {
    if (Math.abs(n - page) > 2) {
      v.canvas.width = 1;
      cache.delete(n);
    }
  });
  renderHighlightOverlays();
  paintSearchOverlay();
  if (selectionRange) paintSelection();
  scheduleSave();
  updateReadingStats();
  if ($("#reference").hidden === false) showReference(referencePage);
}
let pendingNav = null;
async function go(n, animate = false, playSound = true) {
  n = Math.max(1, Math.min(pdf.numPages, Math.round(n)));
  if (!Number.isFinite(n)) return;
  if (turning) {
    pendingNav = n;
    return;
  }
  if (n === page) return;
  clearSelection();
  if (
    animate &&
    Math.abs(n - page) === 1 &&
    zoom === 1 &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    await turn(n > page ? 1 : -1);
    return;
  }
  const activePdf = pdf;
  page = n;
  await render();
  if (playSound && pdf === activePdf && page === n) pageAudio.play();
  centerFilmOnPage("smooth");
}
async function turn(dir) {
  if (turning || page + dir < 1 || page + dir > pdf.numPages) return;
  turning = true;
  try {
    const current = await composite(page),
      next = await composite(page + dir);
    const reverse = rtl ? dir > 0 : dir < 0;
    curl.begin(current, next, current.height * 0.88, reverse);
    curl.p = {
      x: reverse ? current.width * 0.2 : current.width * 0.8,
      y: current.height * 0.86,
    };
    curl.draw();
    pageAudio.play();
    let landed = false;
    let watchdog = null;
    const land = () => {
      if (landed) return;
      landed = true;
      clearTimeout(watchdog);
      page += dir;
      render()
        .catch(fail)
        .finally(() => {
          turning = false;
          const nextNav = pendingNav;
          pendingNav = null;
          if (nextNav && nextNav !== page) go(nextNav, true);
        });
    };
    // A dropped animation frame must never leave the reader stuck mid-turn.
    watchdog = setTimeout(land, 1600);
    curl.release(true, land);
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
// The thumbnail strip follows the page you are on: whenever the page changes
// the matching thumbnail is scrolled to the middle of the strip.
function centerFilmOnPage(behavior = "auto") {
  const strip = $("#filmstrip");
  if (!strip || strip.hidden) return;
  const thumb = strip.querySelector(".thumb.selected");
  if (!thumb) return;
  const target =
    thumb.offsetLeft + thumb.offsetWidth / 2 - strip.clientWidth / 2;
  if (Math.abs(strip.scrollLeft - target) < 2) return;
  strip.scrollTo({ left: Math.max(0, target), behavior });
}
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
  centerFilmOnPage();
}
function updateFilmMarkers() {
  $$(".thumb").forEach((el) => {
    const n = +el.dataset.page;
    el.querySelector(".thumb-mark").textContent = state.paperclips.some(
      (c) => c.page === n,
    )
      ? "●"
      : state.textHighlights?.[n]?.length
        ? "✦"
        : "";
  });
}
const pageAudio = new PageTurnAudio({
  url: pageTurnSoundUrl,
  onError: () => {
    toast(
      "Page audio is unavailable. Tap the speaker to retry; reading still works.",
    );
  },
});
pageAudio.preload();
function updateSoundButton() {
  const button = $("#sound"),
    label = muted
      ? "Unmute recorded page-turn sound"
      : "Mute recorded page-turn sound";
  button.innerHTML = icon(muted ? "volume-x" : "volume-2");
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(muted));
  refreshIcons();
}
function unlockPageAudio(e) {
  if (e.isTrusted) pageAudio.unlock();
}
document.addEventListener("pointerdown", unlockPageAudio, {
  capture: true,
  passive: true,
});
document.addEventListener("keydown", unlockPageAudio, { capture: true });
function dialog(title, body, actions = "") {
  const d = $("#dialog");
  $("#resumeDialog").hidden = true;
  if (d.open) d.close();
  d.innerHTML = `<div class="dialog-head"><div><span class="eyebrow">FLIPVAULT PRO</span><h2>${title}</h2></div><div class="dialog-window-actions"><button id="minimizeDialog" class="icon-btn" aria-label="Minimize dialog" title="Minimize">${icon("minus")}</button><button id="closeDialog" class="icon-btn" aria-label="Close dialog" title="Close">${icon("x")}</button></div></div><div class="dialog-body">${body}</div>${actions ? `<div class="dialog-actions">${actions}</div>` : ""}`;
  d.showModal();
  $("#closeDialog").onclick = () => {
    $("#resumeDialog").hidden = true;
    d.close();
  };
  $("#minimizeDialog").onclick = () => {
    d.close();
    $("#resumeDialog").hidden = false;
  };
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
function editClip(clip, context = {}) {
  const editing = !!clip;
  const commentMode = !editing && context.isComment;
  const c = clip || {
    id: crypto.randomUUID(),
    page: context.page || page,
    edge: commentMode ? "right" : "top",
    position: context.position ?? 0.78,
    color: clipColor,
    note: "",
    quote: context.quote?.slice(0, 5000) || "",
  };
  const quotePreview = c.quote
    ? `<blockquote class="selected-quote">“${esc(c.quote.slice(0, 500))}${c.quote.length > 500 ? "…" : ""}”</blockquote>`
    : "";
  const d = dialog(
    commentMode
      ? "Add a comment"
      : editing
        ? "A note worth keeping."
        : "Mark a little moment.",
    `${quotePreview}<p class="muted">${commentMode ? `Comment on the selected passage on page ${c.page}.` : `A physical bookmark for page ${c.page}. Drag it along the page edge to find its perfect place.`}</p><label class="field-label">CLIP FINISH</label><div class="clip-palette">${[
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
      )}</div><label class="field-label" for="clipEdge">PAGE EDGE</label><select id="clipEdge" class="full-input"><option value="top">Top edge</option><option value="right">Right outer edge</option><option value="bottom">Bottom edge</option></select><label class="field-label" for="clipNote">${commentMode ? "COMMENT" : "LABEL / NOTE"}</label><textarea id="clipNote" rows="3" maxlength="1000" placeholder="${commentMode ? "Write a comment on this passage…" : "A thought, a quote, something to come back to…"}">${esc(c.note)}</textarea>`,
    ` ${editing ? '<button id="deleteClip" class="secondary danger">Remove clip</button>' : ""}<button id="saveClip" class="primary">${editing ? "Save note" : commentMode ? "Save comment" : "Attach paperclip"}</button>`,
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
    const note = $("#clipNote").value.trim();
    if (commentMode && !note) {
      toast("Write a comment before saving it.");
      return;
    }
    Object.assign(c, {
      color,
      edge: $("#clipEdge").value,
      note,
      quote: c.quote || "",
    });
    clipColor = color;
    if (!editing) state.paperclips.push(c);
    d.close();
    renderPageClips($("#uiLayer"), page);
    renderTabs();
    updateFilmMarkers();
    scheduleSave();
    toast(
      editing
        ? "Note saved."
        : commentMode
          ? "Comment saved with its passage."
          : "A little moment, saved.",
    );
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
    `<div class="drawer-head"><div><span class="eyebrow">YOUR PERSONAL SPACE</span><h2>${title}</h2><p>${subtitle}</p></div><div class="drawer-actions"><button id="minimizeDrawer" class="icon-btn" aria-label="Minimize panel">${icon("minus")}</button>${btn("closeDrawer", "x", "Close panel")}</div></div><div class="drawer-content">${body}</div>`;
  $("#drawer").hidden = false;
  $("#drawerBackdrop").hidden = false;
  $("#resumeDrawer").hidden = true;
  $("#closeDrawer").onclick = closeDrawer;
  $("#minimizeDrawer").onclick = () => {
    $("#drawer").hidden = true;
    $("#drawerBackdrop").hidden = true;
    $("#resumeDrawer").hidden = false;
  };
  refreshIcons();
}
function closeDrawer() {
  $("#drawer").hidden = true;
  $("#drawerBackdrop").hidden = true;
  $("#resumeDrawer").hidden = true;
  searchToken++;
}
async function tutorialSeenFlag() {
  try {
    if (localStorage.getItem("flipvault.tutorialSeen") === "1") return true;
  } catch {
    /* private mode: fall back to IndexedDB only */
  }
  return !!(await store.get("settings", "tutorialSeen"));
}

async function markTutorialSeen() {
  try {
    localStorage.setItem("flipvault.tutorialSeen", "1");
  } catch {
    /* ignore */
  }
  await store.put("settings", true, "tutorialSeen").catch(() => {});
}

function bookCard(book, stateForBook, currentHash) {
  const total = book.pageCount || 1;
  const lastPage = Math.max(1, Math.min(total, stateForBook?.lastPage || 1));
  const progress = Math.round((lastPage / total) * 100);
  return `<article class="home-book${book.pdfHash === currentHash ? " current" : ""}" data-hash="${book.pdfHash}"><button class="home-book-open" data-open="${book.pdfHash}" aria-label="Open ${esc(book.title)}"><span class="home-book-cover"><img src="${book.cover}" alt="" loading="lazy"><span class="home-book-ring"></span></span><span class="home-book-body"><strong>${esc(book.title)}</strong><small>${total} pages · ${Math.round((book.fileSize || 0) / 1024)} KB</small><span class="home-progress"><span style="width:${progress}%"></span></span><small class="home-progress-label">${book.pdfHash === currentHash ? "Reading now" : lastPage > 1 ? `Page ${lastPage} of ${total} · ${progress}%` : "Not started"}</small></span></button><button class="home-book-remove" data-remove="${book.pdfHash}" aria-label="Remove ${esc(book.title)}" title="Remove from this device">${icon("trash-2")}</button></article>`;
}

async function renderHome() {
  const books = await store.all("pdfFiles");
  const states = await store.all("readingState");
  const stateFor = (hash) => states.find((s) => s.pdfHash === hash);
  const ordered = [...books].sort(
    (a, b) =>
      (stateFor(b.pdfHash)?.lastOpenedTimestamp || b.importedAt || 0) -
      (stateFor(a.pdfHash)?.lastOpenedTimestamp || a.importedAt || 0),
  );
  $("#homeCount").textContent = books.length
    ? `${books.length} book${books.length === 1 ? "" : "s"} on this device`
    : "No books yet";
  const recent = ordered[0];
  const recentState = recent ? stateFor(recent.pdfHash) : null;
  const continueCard = $("#homeContinue");
  if (recent) {
    const total = recent.pageCount || 1;
    const lastPage = Math.max(1, Math.min(total, recentState?.lastPage || 1));
    const progress = Math.round((lastPage / total) * 100);
    continueCard.hidden = false;
    continueCard.innerHTML = `<div class="continue-cover"><img src="${recent.cover}" alt=""></div><div class="continue-copy"><span class="eyebrow">${lastPage > 1 ? "PICK UP WHERE YOU LEFT OFF" : "START YOUR NEXT BOOK"}</span><h2>${esc(recent.title)}</h2><p>${lastPage > 1 ? `Page ${lastPage} of ${total} · ${progress}% read` : `${total} pages, waiting for you`}</p><span class="home-progress"><span style="width:${progress}%"></span></span></div><button id="homeContinueButton" class="primary">${lastPage > 1 ? "Continue reading" : "Start reading"}</button>`;
    $("#homeContinueButton").onclick = run(async () => {
      const b = await store.get("pdfFiles", recent.pdfHash);
      if (b) await openBook(b);
    });
  } else {
    continueCard.hidden = true;
    continueCard.replaceChildren();
  }
  $("#homeGrid").innerHTML = ordered.length
    ? ordered.map((b) => bookCard(b, stateFor(b.pdfHash), book?.pdfHash)).join("")
    : `<button id="homeEmptyAdd" class="home-empty">${icon("plus")}<strong>Add your first book</strong><span>PDF, EPUB, MOBI/AZW, CBZ/CBR, DjVu, TXT or HTML — imported on this device.</span></button>`;
  $("#homeEmptyAdd")?.addEventListener("click", () => $("#pdfFile").click());
  $$("[data-open]").forEach(
    (el) =>
      (el.onclick = run(async () => {
        const b = await store.get("pdfFiles", el.dataset.open);
        if (b) await openBook(b);
      })),
  );
  $$("[data-remove]").forEach(
    (el) =>
      (el.onclick = run(async (event) => {
        event.stopPropagation();
        const hash = el.dataset.remove;
        const target = books.find((b) => b.pdfHash === hash);
        if (book?.pdfHash === hash) {
          toast("You are reading this book. Open another one before removing it.");
          return;
        }
        if (
          !confirm(
            `Remove “${target?.title || "this book"}” from this device? Saved notes are kept for a re-import.`,
          )
        )
          return;
        await store.remove("pdfFiles", hash);
        await renderHome();
        toast("Book removed from this device.");
      })),
  );
  refreshIcons();
}

function rememberReader(hash) {
  try {
    if (hash) sessionStorage.setItem("flipvault.readingSession", hash);
    else sessionStorage.removeItem("flipvault.readingSession");
  } catch {
    /* private mode: no session memory, the library is still fine */
  }
}

function rememberReaderHash() {
  try {
    return sessionStorage.getItem("flipvault.readingSession");
  } catch {
    return null;
  }
}

async function showHome() {
  if (state) await save();
  rememberReader(null);
  document.body.classList.add("at-home");
  document.body.classList.remove("focus-mode", "focus-filmstrip");
  clearSelection();
  $("#focusPanel").hidden = true;
  $("#focusTools").setAttribute("aria-expanded", "false");
  $("#reference").hidden = true;
  $("#resumeReference").hidden = true;
  $("#bookTitle").textContent = "Welcome";
  document.title = "FlipVault Pro";
  closeDrawer();
  closeSearch();
  clearSelection();
  await renderHome();
  wakeHUD();
}

async function openLastBook() {
  if (book) {
    document.body.classList.remove("at-home");
    await render();
    return;
  }
  const books = await store.all("pdfFiles");
  const states = await store.all("readingState");
  const ranked = [...books].sort(
    (a, b) =>
      (states.find((s) => s.pdfHash === b.pdfHash)?.lastOpenedTimestamp || 0) -
      (states.find((s) => s.pdfHash === a.pdfHash)?.lastOpenedTimestamp || 0),
  );
  if (!ranked.length) {
    toast("Add a book first — your library is empty.");
    return;
  }
  await openBook(ranked[0]);
}

function showClips() {
  const clips = [...state.paperclips].sort((a, b) => a.page - b.page);
  const highlights = Object.entries(state.textHighlights || {})
    .filter(([, items]) => items.length)
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  openDrawer(
    "Little things, kept.",
    "Your paperclips, notes & highlighted passages.",
    `<div class="drawer-stat"><strong>${clips.length}</strong><span>paperclips</span><strong>${highlights.reduce((total, [, items]) => total + items.length, 0)}</strong><span>highlights</span></div><button id="drawerAddClip" class="secondary full">${icon("plus")} Clip this page</button><div class="notes-list">${clips
      .map(
        (c) =>
          `<button class="note-card" data-clip="${c.id}"><span class="note-clip">${clipSVG(c.color)}</span><div><small>PAGE ${c.page} · ${c.edge.toUpperCase()} EDGE</small><strong>${esc(c.note || "An important page")}</strong>${c.quote ? `<small class="quote-preview">“${esc(c.quote.slice(0, 110))}${c.quote.length > 110 ? "…" : ""}”</small>` : ""}</div>${icon("arrow-up-right")}</button>`,
      )
      .join("") || '<div class="empty-state">No paperclips yet.<br>Keep a thought. Mark a discovery.</div>'}</div><h3 class="section-title">Highlighted passages</h3><div class="notes-list">${highlights
      .map(([n, items]) =>
        items
          .map(
            (item) =>
              `<button class="note-card" data-page="${n}" data-highlight="${item.id}"><span class="marker-dot" style="background:${item.color}"></span><div><small>PAGE ${n}</small><strong>“${esc(item.text.slice(0, 120))}${item.text.length > 120 ? "…" : ""}”</strong></div>${icon("arrow-up-right")}</button>`,
          )
          .join(""),
      )
      .join("") || '<p class="muted">Select text on a page, then tap Highlight to keep a passage here.</p>'}</div>`,
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
  $$(".note-card[data-page]").forEach(
    (el) => (el.onclick = () => go(+el.dataset.page)),
  );
  refreshIcons();
}
function showSearch() {
  const bar = $("#readerSearch");
  bar.hidden = false;
  document.body.classList.add("search-open");
  closeSelectionMenus();
  const input = $("#searchInput");
  input.focus();
  input.select();
  if (searchQuery) input.value = searchQuery;
}
function closeSearch() {
  searchToken++;
  searchQuery = "";
  searchHits = [];
  activeSearchHit = -1;
  $("#readerSearch").hidden = true;
  document.body.classList.remove("search-open");
  $("#searchInput").value = "";
  $("#searchStatus").textContent = "0 of 0";
  $("#previousSearchHit").disabled = true;
  $("#nextSearchHit").disabled = true;
  $("#selectSearchHit").disabled = true;
  clearSearchHighlights();
}
async function pageText(n) {
  if (!textCache.has(n)) {
    const pdfPage = await pdf.getPage(n);
    const content = await pdfPage.getTextContent();
    textCache.set(n, {
      items: content.items.filter((item) => typeof item.str === "string"),
      text: canonicalPageText(content.items),
    });
  }
  return textCache.get(n);
}
async function ensureCurrentTextLayer() {
  const layer = $("#textLayer");
  if (Number(layer.dataset.page) !== page || !layer.childNodes.length) {
    const entry = await getPageCanvas(page);
    await renderTextLayer(page, entry, layer);
  }
  return layer;
}
async function navigateSearchHit(index) {
  if (!searchHits.length) return;
  activeSearchHit = (index + searchHits.length) % searchHits.length;
  const hit = searchHits[activeSearchHit];
  $("#searchStatus").textContent = `${activeSearchHit + 1} of ${searchHits.length}`;
  $("#previousSearchHit").disabled = false;
  $("#nextSearchHit").disabled = false;
  $("#selectSearchHit").disabled = false;
  if (hit.page !== page) await go(hit.page, false, false);
  if (hit.page !== page) return;
  await ensureCurrentTextLayer();
  paintSearchOverlay();
  // Bring the exact matched words into view, not merely the page.
  const current = $("#searchLayer .search-rect.current");
  if (current) {
    const rect = current.getBoundingClientRect();
    const viewport = $("#bookViewport").getBoundingClientRect();
    if (rect.top < viewport.top + 90 || rect.bottom > viewport.bottom - 24)
      current.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}
async function selectSearchHit() {
  const index = activeSearchHit;
  const hit = searchHits[index];
  if (!hit) return;
  if (hit.page !== page) await navigateSearchHit(index);
  if (hit.page !== page) return;
  const query = searchQuery;
  const occurrenceOnPage = searchHits
    .slice(0, index)
    .filter((match) => match.page === hit.page).length;
  const ranges = rangesForTextMatches($("#textLayer"), query);
  const match = ranges[occurrenceOnPage] || ranges[0];
  closeSearch();
  if (!match?.range) {
    toast("This match cannot be selected as text in this document.");
    return;
  }
  selectionRange = match.range;
  paintSelection();
  updateSelectionActions();
}
async function searchBook(query) {
  const token = ++searchToken;
  searchQuery = query;
  searchHits = [];
  activeSearchHit = -1;
  clearSearchHighlights();
  if (!query) {
    $("#searchStatus").textContent = "0 of 0";
    return;
  }

  const activePdf = pdf;
  $("#searchStatus").textContent = `Searching 0 / ${pdf.numPages}`;
  for (let n = 1; n <= pdf.numPages; n++) {
    if (token !== searchToken || activePdf !== pdf) return;
    const { text } = await pageText(n);
    for (const match of findTextMatches(text, query))
      searchHits.push({ page: n, ...match });
    $("#searchStatus").textContent =
      `Searching ${n} / ${pdf.numPages} · ${searchHits.length} found`;
    if (n % 4 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  if (token !== searchToken || activePdf !== pdf) return;
  if (!searchHits.length) {
    $("#searchStatus").textContent = "0 of 0 · No matches";
    $("#previousSearchHit").disabled = true;
    $("#nextSearchHit").disabled = true;
    return;
  }
  await navigateSearchHit(0);
}

let searchInputTimer;
$("#searchInput").oninput = () => {
  clearTimeout(searchInputTimer);
  searchToken++;
  searchQuery = $("#searchInput").value.trim();
  searchHits = [];
  activeSearchHit = -1;
  $("#searchStatus").textContent = searchQuery ? "Searching…" : "0 of 0";
  $("#previousSearchHit").disabled = true;
  $("#nextSearchHit").disabled = true;
  $("#selectSearchHit").disabled = true;
  clearSearchHighlights();
  searchInputTimer = setTimeout(() => searchBook(searchQuery).catch(fail), 160);
};
$("#searchInput").onkeydown = (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    navigateSearchHit(activeSearchHit + (event.shiftKey ? -1 : 1)).catch(fail);
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeSearch();
  }
};
$("#focusSearch").onclick = showSearch;
$("#closeSearch").onclick = closeSearch;
$("#previousSearchHit").onclick = () =>
  navigateSearchHit(activeSearchHit - 1).catch(fail);
$("#nextSearchHit").onclick = () =>
  navigateSearchHit(activeSearchHit + 1).catch(fail);
$("#selectSearchHit").onclick = () => selectSearchHit().catch(fail);
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
  p.innerHTML = `<div class="popover-window-actions"><button id="minimizePopover" class="icon-btn" aria-label="Minimize menu" title="Minimize menu">${icon("minus")}</button></div>${html}`;
  p.hidden = false;
  const r = anchor.getBoundingClientRect();
  $("#minimizePopover").onclick = () => {
    p.hidden = true;
    $("#resumePopover").hidden = false;
  };
  $("#resumePopover").hidden = true;
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
// Every theme only filters the rendered page; the PDF file never changes.
const THEMES = [
  ["original", "sun", "Original paper", "The printed page, untouched."],
  ["sepia", "coffee", "Warm parchment", "Dimmed warm paper for long evenings."],
  ["cream", "moon-star", "Dark cream", "Dark, warm and soft — easy at night."],
  ["mocha", "moon", "Mocha", "Deep brown with light text."],
  ["slate", "cloud-moon", "Slate night", "Cool, low-glare charcoal."],
  ["dark", "moon", "AMOLED dark", "Pure black for OLED screens."],
  ["ink", "contrast", "E-ink contrast", "Grey, high contrast."],
];
function themeLabel() {
  return THEMES.find(([id]) => id === theme)?.[2] || "Original paper";
}
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  const label = $("#theme span");
  if (label) label.textContent = themeLabel();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && ["cream", "mocha", "slate", "dark"].includes(theme)) {
    const tint = { cream: "#14100c", mocha: "#100d09", slate: "#0b0f12", dark: "#060b09" };
    meta.content = tint[theme];
  } else if (meta) applyBackground();
}
function showThemes() {
  popover(
    $("#theme"),
    `<span class="menu-label">MAKE YOURSELF COMFORTABLE</span>${THEMES.map(
      ([id, i, label, hint]) =>
        `<button data-theme="${id}" class="menu-item"><span class="menu-copy">${icon(i)}<span><strong>${label}</strong><small>${hint}</small></span></span>${theme === id ? icon("check") : ""}</button>`,
    ).join(
      "",
    )}<hr><span class="menu-label">SURROUNDINGS · THE PAGE KEEPS ITS OWN COLOUR</span><div class="background-options">${[
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
      )}</div><button id="openBackgrounds" class="menu-item">${icon("image")}Background images…</button><label class="menu-item small"><input id="preserveImages" type="checkbox" ${document.body.classList.contains("preserve-images") ? "checked" : ""}> Preserve images in dark mode</label>`,
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
  $("#openBackgrounds").onclick = () => {
    $("#popover").hidden = true;
    showBackgrounds();
  };
  $("#preserveImages").onchange = run(async (e) => {
    document.body.classList.toggle("preserve-images", e.target.checked);
    await store.put("settings", e.target.checked, "preserveImages");
    if (e.target.checked)
      toast(
        "Image preservation keeps original page colors on AMOLED surroundings.",
      );
  });
}
// --- reader artwork -----------------------------------------------------
function applyArtwork() {
  const root = document.documentElement;
  for (const surface of ["home", "reader"]) {
    const image = pickArtwork(artwork, surface, artworkShown[surface]);
    artworkShown[surface] = image?.id || null;
    root.style.setProperty(
      `--${surface}-art`,
      image ? `url("${image.dataUrl}")` : "none",
    );
    root.dataset[surface === "home" ? "homeArt" : "readerArt"] =
      image ? "on" : "off";
  }
  root.style.setProperty("--art-dim", String(artwork.dim ?? 0.62));
}

// A new rotation is drawn once per launch and whenever the app comes back to
// the foreground, so "change every time I open the app" means exactly that.
function rotateArtwork() {
  if (!artwork.rotate || artwork.images.length < 2) return;
  artworkShown = { home: artworkShown.home, reader: artworkShown.reader };
  applyArtwork();
}

async function saveArtwork() {
  await store.put("settings", artwork, "backgroundLibrary");
  applyArtwork();
}

function artworkTile(image, surface) {
  const active = artwork[surface] === image.id;
  return `<button class="background-tile" data-artwork="${image.id}" aria-pressed="${active}" title="${esc(image.name)}"><img alt="" src="${image.dataUrl}" loading="lazy"><span>${esc(image.name)}</span></button>`;
}

function showBackgrounds(target = "reader") {
  const surface = target === "home" ? "home" : "reader";
  const body = `
    <p class="muted">Pick artwork for the library, the reading room, or both. Images are cropped to fill the screen and dimmed so text stays readable; anything under 800 × 800 px is refused because it would look blurred.</p>
    <div class="focus-tools-row" role="group" aria-label="Where this background is used">
      <button class="chip" id="artworkForHome" aria-pressed="${surface === "home"}">${icon("library-big")}Library</button>
      <button class="chip" id="artworkForReader" aria-pressed="${surface === "reader"}">${icon("book-open")}Reading room</button>
    </div>
    <p class="background-note">Each place keeps its own choice.</p>
    <div class="background-preview" id="backgroundPreview"></div>
    <div class="background-actions">
      <button id="addArtwork" class="primary">${icon("image")}Add an image</button>
      <button id="addArtworkPdf" class="secondary">${icon("file")}From a PDF page</button>
      ${artwork.images.length ? `<button id="clearArtwork" class="secondary">${icon("trash-2")}Remove all</button>` : ""}
    </div>
    <div class="background-grid" id="backgroundGrid">
      <button class="background-tile background-none" data-artwork="" aria-pressed="${!artwork[surface]}">${icon("ban")}<span>No background</span></button>
      ${artwork.images.map((image) => artworkTile(image, surface)).join("")}
    </div>
    <label class="menu-item small"><input id="artworkRotate" type="checkbox" ${artwork.rotate ? "checked" : ""}> Change the background every time I open the app</label>
    <label class="field-label" for="artworkDim">DIM THE ARTWORK · ${Math.round((artwork.dim ?? 0.62) * 100)}%</label>
    <input id="artworkDim" class="full-input" type="range" min="0" max="90" step="5" value="${Math.round((artwork.dim ?? 0.62) * 100)}">
    <p class="background-note">JPG, PNG and WebP work. Images stay on this device.</p>`;
  const d = dialog(
    "Backgrounds",
    body,
    `<button id="closeBackgrounds" class="secondary">Done</button>`,
  );
  refreshIcons();
  const paint = () => {
    const image = artwork.images.find((i) => i.id === artwork[surface]);
    const preview = $("#backgroundPreview");
    if (preview)
      preview.style.backgroundImage = image ? `url("${image.dataUrl}")` : "none";
    $$("#backgroundGrid [data-artwork]").forEach((tile) =>
      tile.setAttribute(
        "aria-pressed",
        String((tile.dataset.artwork || null) === (artwork[surface] || null)),
      ),
    );
  };
  paint();
  $("#closeBackgrounds").onclick = () => d.close();
  $("#artworkForHome").onclick = () => {
    d.close();
    showBackgrounds("home");
  };
  $("#artworkForReader").onclick = () => {
    d.close();
    showBackgrounds("reader");
  };
  $$("#backgroundGrid [data-artwork]").forEach(
    (tile) =>
      (tile.onclick = run(async () => {
        artwork[surface] = tile.dataset.artwork || null;
        await saveArtwork();
        paint();
        toast(
          tile.dataset.artwork
            ? "Background updated."
            : "Background removed.",
        );
      })),
  );
  $("#addArtwork").onclick = () => {
    pendingArtworkSurface = surface;
    $("#artworkFile").click();
  };
  $("#addArtworkPdf").onclick = () => {
    pendingArtworkSurface = surface;
    $("#artworkPdf").click();
  };
  const clear = $("#clearArtwork");
  if (clear)
    clear.onclick = run(async () => {
      artwork = { ...EMPTY_LIBRARY, dim: artwork.dim };
      await saveArtwork();
      d.close();
      toast("All backgrounds removed.");
    });
  $("#artworkRotate").onchange = run(async (event) => {
    artwork.rotate = event.target.checked;
    await saveArtwork();
    toast(
      artwork.rotate
        ? "A different background will greet you each time."
        : "Your background will stay put.",
    );
  });
  $("#artworkDim").oninput = (event) => {
    artwork.dim = Number(event.target.value) / 100;
    document.documentElement.style.setProperty("--art-dim", String(artwork.dim));
    event.target
      .closest(".dialog-body")
      .querySelector("label[for=artworkDim]")?.replaceChildren(
        document.createTextNode(
          `DIM THE ARTWORK · ${Math.round(artwork.dim * 100)}%`,
        ),
      );
  };
  $("#artworkDim").onchange = run(() => saveArtwork());
}

let pendingArtworkSurface = "reader";

async function addArtworkFromFile(file) {
  const surface = pendingArtworkSurface;
  let prepared;
  try {
    prepared = await readArtworkFile(file);
  } catch (error) {
    // A file that fails the size rules is a normal answer, not a crash.
    toast(error.message);
    return;
  }
  const image = newArtwork({
    ...prepared,
    name: (file.name || "Background").replace(/\.[^.]+$/, ""),
  });
  artwork.images = [...artwork.images, image];
  artwork[surface] = image.id;
  await saveArtwork();
  toast(`${image.name} is now your ${surface === "home" ? "library" : "reading room"} background.`);
  showBackgrounds(surface);
}

async function addArtworkFromPdf(file) {
  const surface = pendingArtworkSurface;
  const label = surface === "home" ? "library" : "reading room";
  const d = dialog(
    "Artwork from a PDF",
    `<p class="muted">The chosen page is rendered once and kept as a picture on this device. The PDF itself is not stored.</p><label class="field-label" for="artworkPage">PAGE NUMBER</label><input id="artworkPage" class="full-input" type="number" min="1" value="1">`,
    `<button id="cancelArtworkPage" class="secondary">Cancel</button><button id="confirmArtworkPage" class="primary">Use this page</button>`,
  );
  $("#cancelArtworkPage").onclick = () => d.close();
  $("#confirmArtworkPage").onclick = run(async () => {
    const requested = Math.max(1, Number($("#artworkPage").value) || 1);
    const data = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data }).promise;
    try {
      const number = Math.min(requested, doc.numPages);
      const source = await doc.getPage(number);
      const base = source.getViewport({ scale: 1 });
      const scale = Math.min(3, 1800 / Math.max(base.width, base.height));
      const viewport = source.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await source.render({
        canvasContext: canvas.getContext("2d"),
        viewport,
      }).promise;
      const prepared = artworkFromCanvas(canvas, file.name);
      const image = newArtwork({
        ...prepared,
        name: `${(file.name || "PDF").replace(/\.[^.]+$/, "")} · page ${number}`,
      });
      artwork.images = [...artwork.images, image];
      artwork[surface] = image.id;
      await saveArtwork();
      d.close();
      toast(`Page ${number} is now your ${label} background.`);
      showBackgrounds(surface);
    } finally {
      doc.destroy?.();
    }
  });
}

$("#artworkFile").onchange = run(async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (file) await addArtworkFromFile(file);
});
$("#artworkPdf").onchange = run(async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (file) await addArtworkFromPdf(file);
});

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
  for (const [n, items] of Object.entries(state.textHighlights || {})) {
    if (!items.length) continue;
    const p = out.getPage(+n - 1),
      { width, height } = p.getSize();
    for (const item of items) {
      const hex = item.color.replace("#", "");
      const color = rgb(
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
      );
      for (const rect of item.rects || []) {
        p.drawRectangle({
          x: rect.x * width,
          y: height - (rect.y + rect.h) * height,
          width: rect.w * width,
          height: rect.h * height,
          color,
          opacity: 0.35,
        });
      }
    }
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
      ...Object.keys(state.textHighlights || {})
        .filter((n) => state.textHighlights[n]?.length)
        .map(Number),
    ]),
  ].sort((a, b) => a - b);
  if (!pages.length) {
    toast("Highlight a passage or add a paperclip to build your study summary.");
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
function referenceBox() {
  const fallback = {
    left: Math.max(12, innerWidth - 320),
    top: Math.max(72, innerHeight - 430),
    width: Math.min(300, innerWidth - 24),
    height: Math.min(360, innerHeight - 140),
  };
  try {
    const saved = JSON.parse(localStorage.getItem("flipvault.referenceBox"));
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.width))
      return { ...fallback, ...saved };
  } catch {
    /* ignore malformed saved geometry */
  }
  return fallback;
}

function clampReference(box) {
  const width = Math.max(190, Math.min(box.width, innerWidth - 16));
  const height = Math.max(180, Math.min(box.height, innerHeight - 90));
  return {
    width,
    height,
    left: Math.max(8, Math.min(box.left, innerWidth - width - 8)),
    top: Math.max(8, Math.min(box.top, innerHeight - height - 8)),
  };
}

function applyReferenceBox(box) {
  const panel = $("#reference"),
    safe = clampReference(box);
  panel.style.left = `${safe.left}px`;
  panel.style.top = `${safe.top}px`;
  panel.style.width = `${safe.width}px`;
  panel.style.height = `${safe.height}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
  try {
    localStorage.setItem("flipvault.referenceBox", JSON.stringify(safe));
  } catch {
    /* storage may be unavailable; geometry is cosmetic */
  }
  return safe;
}

async function showReference(n) {
  if (!pdf) return;
  referencePage = Math.max(1, Math.min(pdf.numPages, n));
  const entry = await getPageCanvas(referencePage, 1);
  const panel = $("#reference");
  panel.hidden = false;
  panel.innerHTML = `<div class="reference-head" id="referenceHead" title="Drag to move"><span class="reference-grip">${icon("panels-left-bottom")}</span><strong>Keep in view</strong><div class="reference-nav"><button id="refPrev" class="icon-btn" aria-label="Previous reference page">${icon("chevron-left")}</button><input id="refInput" aria-label="Reference page" type="number" min="1" max="${pdf.numPages}" value="${referencePage}"><button id="refNext" class="icon-btn" aria-label="Next reference page">${icon("chevron-right")}</button></div><button id="minimizeReference" class="icon-btn" aria-label="Minimize reference">${icon("minus")}</button><button id="closeReference" class="icon-btn reference-close" aria-label="Close reference view">${icon("x")}</button></div><div class="reference-body"><canvas id="referenceCanvas"></canvas></div><div id="referenceResize" class="reference-resize" role="separator" aria-label="Resize reference view"></div>`;
  applyReferenceBox(referenceBox());
  const c = $("#referenceCanvas");
  c.width = entry.canvas.width;
  c.height = entry.canvas.height;
  c.getContext("2d").drawImage(entry.canvas, 0, 0);
  $("#refPrev").onclick = () => showReference(referencePage - 1);
  $("#refNext").onclick = () => showReference(referencePage + 1);
  $("#refInput").onchange = (e) => showReference(+e.target.value);
  $("#closeReference").onclick = () => {
    panel.hidden = true;
    $("#resumeReference").hidden = true;
  };
  $("#minimizeReference").onclick = () => {
    panel.hidden = true;
    $("#resumeReference").hidden = false;
  };
  $("#resumeReference").hidden = true;

  // Drag from the header; resize from the corner grip. Both are pointer based
  // so they work with a finger, not just a mouse.
  const head = $("#referenceHead");
  head.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button,input")) return;
    const box = panel.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, left: box.left, top: box.top };
    head.setPointerCapture(event.pointerId);
    const move = (e) => {
      applyReferenceBox({
        ...referenceBox(),
        left: start.left + (e.clientX - start.x),
        top: start.top + (e.clientY - start.y),
        width: panel.offsetWidth,
        height: panel.offsetHeight,
      });
    };
    const up = () => {
      head.removeEventListener("pointermove", move);
      head.removeEventListener("pointerup", up);
      head.removeEventListener("pointercancel", up);
    };
    head.addEventListener("pointermove", move);
    head.addEventListener("pointerup", up);
    head.addEventListener("pointercancel", up);
  });
  head.addEventListener("dblclick", () =>
    applyReferenceBox({
      left: Math.max(12, innerWidth - 320),
      top: Math.max(72, innerHeight - 430),
      width: 300,
      height: 360,
    }),
  );

  const grip = $("#referenceResize");
  grip.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const box = panel.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, width: box.width, height: box.height };
    grip.setPointerCapture(event.pointerId);
    const move = (e) => {
      applyReferenceBox({
        left: panel.offsetLeft,
        top: panel.offsetTop,
        width: start.width + (e.clientX - start.x),
        height: start.height + (e.clientY - start.y),
      });
    };
    const up = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", up);
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
  });
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
  }
}
function readerToolsBody() {
  const filmOn = !$("#filmstrip").hidden;
  const focusOn = document.body.classList.contains("focus-mode");
  const fullscreenAvailable = !!document.fullscreenEnabled;
  return `<div class="focus-tools-head"><strong>Reader tools</strong><button id="minimizeFocusTools" class="icon-btn" aria-label="Close reader tools">${icon("x")}</button></div>
    <span class="menu-label">APPEARANCE</span>
    <div class="focus-tools-row"><button id="toolLayout" class="chip">${icon("panels-top-left")}${mode === "auto" ? "Auto spread" : mode === "spread" ? "Book spread" : "Single page"}</button><button id="toolTheme" class="chip">${icon("sun")}${themeLabel()}</button><button id="toolBackground" class="chip">${icon("image")}Background</button></div>
    <span class="menu-label">PAGES</span>
    <div class="focus-tools-grid"><button id="toolFilmstrip" aria-pressed="${filmOn}">${icon("gallery-horizontal-end")}<span>Page thumbnails</span></button><button id="toolGoToPage">${icon("book-open")}<span>Go to page</span></button><button id="toolBookmark">${icon("bookmark-plus")}<span>Bookmark page</span></button><button id="toolReference">${icon("panels-left-bottom")}<span>Reference view</span></button><button id="toolSound">${icon(muted ? "volume-x" : "volume-2")}<span>${muted ? "Sound off" : "Page sound"}</span></button><button id="toolTimer">${icon("timer")}<span>${focusEnd ? "Stop timer" : "20-min ritual"}</span></button>${fullscreenAvailable ? `<button id="toolFullscreen">${icon("expand")}<span>Fullscreen</span></button>` : ""}<button id="toolGuide">${icon("circle-help")}<span>Reader guide</span></button><button id="toolTour">${icon("book-open-check")}<span>Guided tour</span></button><button id="toolHome">${icon("library-big")}<span>My library</span></button></div>
    <p class="fine-print">Select text by pressing and holding a word, then keep dragging to extend the selection.</p>`;
}

function openReaderTools() {
  const panel = $("#focusPanel"),
    button = $("#focusTools");
  // The tools panel and the selection bar would fight for the same corner.
  clearSelection();
  closeSelectionMenus();
  panel.innerHTML = readerToolsBody();
  const box = button.getBoundingClientRect();
  panel.style.top = `${Math.round(box.bottom + 8)}px`;
  panel.style.right = `${Math.max(8, Math.round(innerWidth - box.right))}px`;
  panel.hidden = false;
  button.setAttribute("aria-expanded", "true");
  refreshIcons();

  const close = () => {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };
  const act = (id, fn) => {
    const el = $("#" + id);
    if (el) el.onclick = () => {
      close();
      fn();
    };
  };
  $("#minimizeFocusTools").onclick = close;
  act("toolLayout", () => setTimeout(() => toggleMenu("layout", showLayout)));
  act("toolTheme", () => setTimeout(() => toggleMenu("theme", showThemes)));
  act("toolBackground", () => showBackgrounds());
  act("toolReference", () => showReference(page));
  act("toolTimer", () => {
    focusEnd = focusEnd ? 0 : Date.now() + 20 * 60000;
    updateReadingStats();
    toast(focusEnd ? "Twenty minutes, just you and your book." : "Reading timer stopped.");
  });
  act("toolFullscreen", () =>
    run(async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    })()
  );
  act("toolGuide", showHelp);
  act("toolTour", () => showTutorial(0));
  act("toolHome", () => run(async () => {
    await save();
    showHome();
  })());
  act("toolBookmark", () => editClip());
  act("toolSound", () => $("#sound").click());
  $("#toolFilmstrip").onclick = () => {
    const show = $("#filmstrip").hidden;
    $("#filmstrip").hidden = !show;
    document.body.classList.toggle(
      "focus-filmstrip",
      show && document.body.classList.contains("focus-mode"),
    );
    $("#filmToggle").classList.toggle("active", show);
    $("#toolFilmstrip").setAttribute("aria-pressed", String(show));
    centerFilmOnPage();
  };
  $("#toolGoToPage").onclick = () => {
    close();
    const pageDialog = dialog(
      "Go to page",
      `<p class="muted">Enter a page from 1 to ${pdf.numPages}.</p><label class="field-label" for="focusPageInput">PAGE NUMBER</label><input id="focusPageInput" class="full-input" type="number" min="1" max="${pdf.numPages}" value="${page}">`,
      `<button id="cancelFocusPage" class="secondary">Cancel</button><button id="goToFocusPage" class="primary">Go to page</button>`,
    );
    $("#focusPageInput").focus();
    $("#focusPageInput").select();
    $("#cancelFocusPage").onclick = () => pageDialog.close();
    $("#goToFocusPage").onclick = run(async () => {
      const target = Number($("#focusPageInput").value);
      if (!Number.isInteger(target) || target < 1 || target > pdf.numPages) {
        toast(`Choose a page from 1 to ${pdf.numPages}.`);
        return;
      }
      await go(target);
      pageDialog.close();
    });
  };
}

const tutorialSteps = [
  {
    title: "Welcome to FlipVault Pro.",
    eyebrow: "1 OF 3 · YOUR READING ROOM",
    text: "Everything stays on this device. Your library is the first screen: pick up any book where you left it, or add a new one.",
    visual: "library-big",
  },
  {
    title: "Read without clutter.",
    eyebrow: "2 OF 3 · TURN & ZOOM",
    text: "Turn pages with a thumbnail or by holding and dragging across the paper. Pinch to zoom and drag to pan. Double-tap toggles a closer look.",
    visual: "book-open",
  },
  {
    title: "Keep what matters.",
    eyebrow: "3 OF 3 · SELECT & HIGHLIGHT",
    text: "Press and hold a word to select it, then keep dragging to extend the selection. Highlight it, look up its meaning, copy, translate or comment. No selection mode, no marker, no eraser.",
    visual: "type",
  },
];
function showTutorial(step = 0) {
  step = Math.max(0, Math.min(tutorialSteps.length - 1, step));
  const item = tutorialSteps[step];
  const actions = `<button id="tutorialSkip" class="secondary">${step === tutorialSteps.length - 1 ? "Finish" : "Skip tour"}</button><span class="tutorial-spacer"></span>${step ? '<button id="tutorialBack" class="secondary">Back</button>' : ""}<button id="tutorialNext" class="primary">${step === tutorialSteps.length - 1 ? "Start reading" : "Next"}</button>`;
  const d = dialog(
    item.title,
    `<div class="tutorial-card"><span class="tutorial-eyebrow">${item.eyebrow}</span><div class="tutorial-illustration">${icon(item.visual)}</div><p>${item.text}</p><div class="tutorial-dots" aria-label="Step ${step + 1} of ${tutorialSteps.length}">${tutorialSteps.map((_, i) => `<span class="${i === step ? "active" : ""}"></span>`).join("")}</div></div>`,
    actions,
  );
  const finish = () => {
    d.close();
    markTutorialSeen().catch(() => {});
  };
  // Closing the window with its own X must also retire the tour for good.
  const closeButton = $("#closeDialog");
  if (closeButton) closeButton.onclick = finish;
  $("#tutorialSkip").onclick = finish;
  $("#tutorialNext").onclick = () =>
    step === tutorialSteps.length - 1 ? finish() : showTutorial(step + 1);
  if (step) $("#tutorialBack").onclick = () => showTutorial(step - 1);
}
function updateFocusFilmstrip() {
  const control = $("#toolFilmstrip");
  if (control) control.setAttribute("aria-pressed", String(!$("#filmstrip").hidden));
  $("#filmToggle").classList.toggle("active", !$("#filmstrip").hidden);
}
function showHelp() {
  $("#popover").hidden = true;
  dialog(
    "Made for your fingertips.",
    `<p>Turn pages by tapping a thumbnail or holding and dragging anywhere on the page. Drag left for the next page; drag right for the previous page. Manga mode reverses the direction.</p><div class="gesture-guide"><article><span>${icon("move-horizontal")}</span><strong>Turn a page</strong><small>Hold, then swipe across the paper.</small></article><article><span>${icon("hand")}</span><strong>Zoom & move</strong><small>Pinch to zoom; drag to pan. Double-tap to enlarge.</small></article><article><span>${icon("type")}</span><strong>Select & keep</strong><small>Press and hold a word, then drag to extend the selection.</small></article><article><span>${icon("paperclip")}</span><strong>Save a thought</strong><small>Add a page clip to bookmark it and attach a note.</small></article></div><div class="info-note"><strong>Reader tools</strong> in the top bar holds thumbnails, page jumps, appearance, backgrounds, sound and the guided tour. <strong>Find</strong> sits next to it.</div>`,
    `<button id="replayTutorial" class="secondary">Start the guided tour</button>`,
  );
  $("#replayTutorial").onclick = () => showTutorial(0);
}
const pointers = new Map();
let lastTap = 0,
  zoomTimer;
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
    x: ((e.clientX - r.left) / r.width) * w,
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
    if (!e.target.closest("#selectionActions, #selectionMenu")) {
      if (selectionRange) {
        // A tap anywhere on the page dismisses the selection, exactly like
        // every other PDF reader, and does not turn a page.
        clearSelection();
        closeSelectionMenus();
        lastTap = 0;
        return;
      }
      clearHold();
      hold = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        timer: setTimeout(() => {
          hold = null;
          if (!ready || turning) return;
          if (!beginSelectionAt(e.clientX, e.clientY, e.pointerId))
            navigator.vibrate?.(0);
        }, HOLD_MS),
      };
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    surface.setPointerCapture(e.pointerId);
    if (pointers.size === 2) {
      clearHold();
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
    if (zoom > 1) {
      gesture.pan = true;
      gesture.scrollX = $("#bookViewport").scrollLeft;
      gesture.scrollY = $("#bookViewport").scrollTop;
      return;
    }
    if (onLeft) return;
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
  if (selecting && selecting.pointerId === e.pointerId) {
    e.preventDefault();
    extendSelectionTo(e.clientX, e.clientY);
    return;
  }
  if (hold && hold.pointerId === e.pointerId) {
    if (Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 14) clearHold();
    else return;
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
    gesture.lastX = (pts[0].x + pts[1].x) / 2;
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
  clearHold();
  clearTimeout(holdTimer);
  if (selecting && selecting.pointerId === e.pointerId) {
    if (cancel) clearSelection();
    else finishSelection();
    return;
  }
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
    if (complete) pageAudio.play();
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
  if (g.leftPage && !g.pan) {
    // The left leaf of a spread belongs to the previous page: a tap or a
    // horizontal drag on it goes back, mirroring "drag anywhere".
    const dx = e.clientX - g.startX,
      dy = e.clientY - g.startY;
    if (
      Math.hypot(dx, dy) < 8 ||
      horizontalIntent(dx, dy)
    ) {
      await go(g.leftPage);
      return;
    }
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
async function setZoom(z) {
  zoom = Math.max(1, Math.min(4, z));
  surface.style.setProperty("--zoom", zoom);
  $("#bookViewport").classList.toggle("zoomed", zoom > 1);
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
function leaveFocusMode() {
  autoFocus = false;
  document.body.classList.remove("focus-mode", "focus-filmstrip");
  fullscreen = false;
  $("#focusPanel").hidden = true;
  $("#focusTools").setAttribute("aria-expanded", "false");
  $("#filmstrip").hidden = false;
  $("#focus").innerHTML = icon("maximize") + "<span>Focus mode</span>";
  refreshIcons();
  cache.clear();
  render().catch(fail);
}
on("exitFocus", leaveFocusMode);
$("#resumeDialog").onclick = () => {
  $("#resumeDialog").hidden = true;
  $("#dialog").showModal();
};
$("#resumeDrawer").onclick = () => {
  $("#resumeDrawer").hidden = true;
  $("#drawer").hidden = false;
  $("#drawerBackdrop").hidden = false;
};
$("#resumePopover").onclick = () => {
  $("#resumePopover").hidden = true;
  $("#popover").hidden = false;
};
$("#resumeReference").onclick = () => {
  $("#resumeReference").hidden = true;
  $("#reference").hidden = false;
};
$("#focusTools").onclick = () => {
  if ($("#focusPanel").hidden) openReaderTools();
  else {
    $("#focusPanel").hidden = true;
    $("#focusTools").setAttribute("aria-expanded", "false");
  }
};
on("library", showHome);
on("reader", openLastBook);
on("clips", showClips);
on("search", showSearch);
on("help", showHelp);
on("addClip", () => editClip());
on("theme", () => toggleMenu("theme", showThemes));
on("layout", () => toggleMenu("layout", showLayout));
on("vault", showVault);
on("export", () => toggleMenu("export", showExport));
on("import", () => $("#pdfFile").click());
$("#homeImport").onclick = () => $("#pdfFile").click();
$("#homeBackup").onclick = run(() => showVault());
$("#crumbHome").onclick = run(() => showHome());
$("#homeBrand").onclick = run(() => showHome());
on("prevSmall", () => go(page - 1, true));
on("nextSmall", () => go(page + 1, true));
on("first", () => go(1));
on("last", () => go(pdf.numPages));
on("sound", async () => {
  muted = !muted;
  pageAudio.setMuted(muted);
  updateSoundButton();
  if (!muted) pageAudio.unlock();
  await store.put("settings", muted, "pageSoundMuted");
  toast(muted ? "Page sounds off." : "Recorded page sounds on.");
});
on("focus", () => {
  autoFocus = false;
  fullscreen = !document.body.classList.contains("focus-mode");
  if (fullscreen) {
    document.body.classList.add("focus-mode");
    $("#focus").innerHTML = icon("minimize") + "<span>Exit focus</span>";
    $("#focusPanel").hidden = true;
    $("#focusTools").setAttribute("aria-expanded", "false");
  } else leaveFocusMode();
  refreshIcons();
  setTimeout(() => {
    cache.clear();
    render().catch(fail);
  }, 240);
});
on("filmToggle", () => {
  $("#filmstrip").hidden = !$("#filmstrip").hidden;
  if (document.body.classList.contains("focus-mode"))
    document.body.classList.toggle("focus-filmstrip", !$("#filmstrip").hidden);
  $("#filmToggle").classList.toggle("active", !$("#filmstrip").hidden);
  centerFilmOnPage();
  setTimeout(() => {
    cache.clear();
    render().catch(fail);
  }, 100);
});
$("#pageInput").onchange = run((e) => go(+e.target.value));
$("#drawerBackdrop").onclick = closeDrawer;
$("#pdfFile").onchange = run(async (e) => {
  for (const f of e.target.files) {
    if (!supportsBook(f.name)) {
      toast(`Unsupported file: ${f.name}`);
      continue;
    }
    await importPDF(f);
  }
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
  if (
    !e.target.closest("#popover,#theme,#layout,#more,#export,#resumePopover")
  ) {
    $("#popover").hidden = true;
    $("#resumePopover").hidden = true;
  }
});
document.addEventListener("keydown", (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (e.key === "Escape") {
    if ($("#dialog").open) return;
    closeDrawer();
    $("#popover").hidden = true;
    $("#resumePopover").hidden = true;
    if (document.body.classList.contains("focus-mode")) leaveFocusMode();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
    e.preventDefault();
    showSearch();
    return;
  }
  if (typing || $("#dialog").open || !ready) return;
  const k = e.key.toLowerCase();
  if (k === "arrowright") go(page + (rtl ? -1 : 1), true).catch(fail);
  if (k === "arrowleft") go(page - (rtl ? -1 : 1), true).catch(fail);
});
let resizeTimer,
  autoFocus = false;
function syncFocusWithViewport() {
  if (!pdf || !autoFocus) return;
  const narrow = matchMedia("(max-width: 700px)").matches;
  const focused = document.body.classList.contains("focus-mode");
  if (!narrow && focused) {
    // A phone layout turned this on; a desktop window has room for the rail,
    // toolbar and footer again.
    document.body.classList.remove("focus-mode");
    fullscreen = false;
    $("#focusPanel").hidden = true;
    $("#focusTools").setAttribute("aria-expanded", "false");
    $("#focus").innerHTML = icon("maximize") + "<span>Focus mode</span>";
    refreshIcons();
  } else if (narrow && !focused) {
    document.body.classList.add("focus-mode", "focus-filmstrip");
    fullscreen = true;
  }
}
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!pdf) return;
    syncFocusWithViewport();
    cache.clear();
    render().catch(fail);
  }, 250);
});
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e;
});
document.addEventListener("visibilitychange", () => {
  pageAudio.setBackgrounded(document.hidden);
  if (document.hidden) {
    clearTimeout(saveTimer);
    save().catch(fail);
  } else if (state) {
    sessionStart = Date.now();
    baseSeconds = state.totalReadingTimeSeconds || 0;
  }
});
window.addEventListener("pagehide", () => {
  pageAudio.stop();
  save().catch(() => {});
});
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
      if (supportsBook(f.name)) await importPDF(f);
  }),
);
async function openWithUrl(url) {
  if (!url || !/^(content|file):/i.test(url)) return;
  const guessedName = decodeURIComponent(url.split("/").pop() || "");
  const response = await fetch(Capacitor.convertFileSrc(url));
  if (!response.ok) throw new Error("That document could not be opened.");
  const blob = await response.blob();
  const typeToExtension = {
    "application/pdf": "pdf",
    "application/epub+zip": "epub",
    "application/x-mobipocket-ebook": "mobi",
    "application/vnd.comicbook+zip": "cbz",
    "image/vnd.djvu": "djvu",
    "text/plain": "txt",
    "text/html": "html",
  };
  let name = guessedName;
  if (!name || !supportsBook(name))
    name = `Shared document.${typeToExtension[blob.type] || "pdf"}`;
  const file = new File([blob], name, { type: blob.type || "application/pdf" });
  if (!supportsBook(file.name)) {
    toast("That file type is not supported yet.");
    return;
  }
  await importPDF(file);
}

async function listenForSharedDocuments() {
  if (!store.isNative()) return;
  let App;
  try {
    ({ App } = await import("@capacitor/app"));
  } catch {
    return;
  }
  try {
    const launch = await App.getLaunchUrl();
    if (launch?.url) await openWithUrl(launch.url);
  } catch {
    /* no launch URL */
  }
  App.addListener("appUrlOpen", (event) => {
    openWithUrl(event.url).catch(fail);
  }).catch(() => {});
  // Android can stop and restart the WebView without a real page unload, so
  // persist the reading position on every background trip and keep the clock
  // honest when the reader comes back.
  App.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) {
      save().catch(() => {});
      return;
    }
    if (state) {
      sessionStart = Date.now();
      baseSeconds = state.totalReadingTimeSeconds || 0;
    }
    rotateArtwork();
  }).catch(() => {});
}

async function init() {
  await store.openDB();
  muted = !!(await store.get("settings", "pageSoundMuted"));
  pageAudio.setMuted(muted);
  pageAudio.setBackgrounded(document.hidden);
  updateSoundButton();
  const savedBackground = await store.get("settings", "readerBackground");
  background = ["black", "charcoal", "forest", "parchment"].includes(
    savedBackground,
  )
    ? savedBackground
    : "black";
  applyBackground();
  artwork = {
    ...EMPTY_LIBRARY,
    ...((await store.get("settings", "backgroundLibrary")) || {}),
  };
  applyArtwork();
  document.body.classList.toggle(
    "preserve-images",
    !!(await store.get("settings", "preserveImages")),
  );
  navigator.storage?.persist?.().catch(() => {});
  nativeVaultEnabled =
    store.isNative() && !!(await store.get("settings", "nativeAutoBackup"));

  // A cold start lands in the library. A WebView that Android reloaded while
  // the reader was open (a brief minimise, a memory trim) resumes that book
  // instead, so the reader never loses its place; an explicit trip to the
  // library clears the marker.
  const resumeHash = rememberReaderHash();
  document.body.classList.add("at-home");
  // Import the sample book before the library paints so the first frame
  // already shows a cover and a Continue-reading card.
  if (!(await store.all("pdfFiles")).length) {
    const data = await makeDemo();
    await importPDF(
      new File([data], "The art of paying attention.pdf", {
        type: "application/pdf",
      }),
      { open: false },
    );
  }
  await showHome();
  if (resumeHash) {
    const recent = await store.get("pdfFiles", resumeHash);
    if (recent) await openBook(recent);
  }
  // The guided tour belongs to the very first open only; dismissing it once
  // (skip, finish or the close button) is enough for it never to return.
  if (!resumeHash && !(await tutorialSeenFlag())) {
    await markTutorialSeen();
    showTutorial(0);
  }

  if (import.meta.env.PROD && !store.isNative() && "serviceWorker" in navigator)
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js")
      .catch(() => {});
  await listenForSharedDocuments().catch(() => {});
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
