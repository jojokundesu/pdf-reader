# FlipVault Pro {{VERSION}}

A private, offline reading room for Android and the browser. PDF pages retain their source rendering; supported ebooks, text and comic archives are converted locally into page-based reading copies.

> **Review candidate only — 1.4.0 is not published as a stable release.** The stable Android download remains the last approved version until this candidate has been checked and explicitly approved.

## What is new in 1.4.0

- Added on-device imports for EPUB, MOBI, AZW/AZW3, CBZ/CBR, DjVu/DJV, TXT and HTML/HTM alongside PDF. No source file is uploaded. EPUB/MOBI text is reflowed into clean pages, comic archives become naturally ordered page images, and DjVu pages are rasterized.
- Added a Select text tool for PDF text layers and reflowed text: drag to select, then use contextual Copy or Share actions. The control is also available from focus-mode Reader tools.
- Embedded Noto Sans Latin, Bengali, Devanagari, Tamil and Telugu fonts in reflowed text documents, retaining selectable, copyable text for those scripts.
- Reduced rendering cost on phones: lower peak canvas memory, duplicate-page-render coalescing, and a 1.6× device-pixel-ratio ceiling on small/lower-memory devices, while keeping the existing animated turn path.
- Added browser integration coverage for Unicode TXT and EPUB, CBZ ordering, actual text-layer selection/copy, focus-mode controls and existing regression flows.

### Import limits to know before testing

- DRM-protected books, password-protected documents and encrypted comic archives are not supported. CBR multi-volume archives are not supported.
- EPUB and MOBI/AZW are reflowed as text. Original CSS/layout, embedded illustrations, audio/video, interactive content and remote assets are intentionally not carried over. Scripts do not run and external resources are never fetched.
- DjVu and comic pages are raster images; they do not gain OCR or selectable text. Search and selection work on text-based PDFs and reflowed text formats, not image-only scans.
- Reflowed text embeds Latin, Bengali, Devanagari, Tamil and Telugu fonts. Glyphs from other writing systems may be replaced.
- Non-PDF source files are converted for the reader and are not retained as originals. Keep a separate copy of your source files.

## What is in this release

| File                                       | What it is                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `FlipVault-Pro-Android.apk`                | Android app, package `com.flipvault.pro`, complete offline reader and PDF engine |
| `FlipVault-Pro-web.zip`                    | Same app as a static website; unzip onto any HTTPS host                          |
| `FlipVault-Pro-signing-certificate.sha256` | Public SHA-256 certificate fingerprint of the signing key used for this build    |

Requirements: Android 8.0 (API 26) or newer for the APK. The web build needs a current browser with
IndexedDB; hosting it over HTTPS enables install-to-home-screen.

## How to install

1. Download `FlipVault-Pro-Android.apk` on the phone.
2. Tap the file and allow installing from the browser/file manager if Android asks.
3. Open **FlipVault Pro**. The first launch creates a 12-page sample book, _The art of paying
   attention_, so the reader is usable immediately.
4. Use **+** to import a PDF or supported EPUB, MOBI/AZW, CBZ/CBR, DjVu, TXT or HTML file from device storage. Import is offline; converted formats have the limits listed above.

Updating later: install the newer `FlipVault-Pro-Android.apk` over the top of the existing app.
Books, notes and positions are kept, because the package name and signing certificate are unchanged
and the version code increases. No uninstall is needed.

## How to use it

**Reading**

- Drag anywhere across a page with the **hand / Read** tool selected to turn it: drag left for the
  next page, right for the previous one (Manga mode reverses this). A deliberate drag of about 22% of
  the page width, or a short brisk flick, completes the turn.
- Corner and edge peels use the same fold physics. A stationary hold or a vertical drag does
  nothing, and a second finger cancels the gesture so pinch zoom can take over.
- Above 100% zoom a one-finger drag pans the page; return to 100% or use the arrows to turn.
- Toolbar controls cover single/spread/auto layout, RTL reading order, 1–4x zoom, themes and the
  reader background (Pure black, Charcoal, Forest, Warm brown). Pure black is the default; the
  background never recolours your PDF.

**Marking up**

- Pick a marker to draw on the PDF layer; choose from six colours or a custom picker, 8/18/32 px
  presets or a 4–60 px brush, 15–70% opacity, and a straight-line toggle with 350 ms
  hold-to-straighten.
- The precision eraser (10–80 px) removes part of a stroke, the whole-stroke eraser removes all of
  it, and each page keeps 60 undo/redo steps for the session.
- Marker, eraser and paperclip layers are independent, so ink never lands on top of the bookmarks.

**Finding your place**

- Paperclips mark pages with a note; drag them along the page edge or move them between edges.
  Full-book bookmark tabs and a notes drawer list everything.
- Full-text search returns snippets and pulses the destination page.
- The filmstrip shows lazy thumbnails with indicators for annotated pages and bookmarks.

**Focus mode**

- The focus timer hides its own controls while idle, estimates reading time and remaining time from
  elapsed time and pages traversed, and offers a 20-minute reading ritual plus a floating reference
  view that navigates independently.
- The speaker button toggles the page-turn sound; the choice is remembered across books and
  restarts. Page turns play a bundled recording of a paper page turn — no network audio, no
  analytics, no account.

**Keeping your notes**

- Everything lives in the app: IndexedDB holds the original PDFs plus reading state, and the app
  requests persistent storage where the platform allows it.
- The shield button downloads a `.flipvault.json` vault backup. Vaults store annotations and
  positions, **not** book binaries, so keep your original files and re-import them after a
  restore; their source fingerprints reattach saved notes even if filenames changed.
- On Android, enable auto-backup to write `Documents/FlipVault/Auto-backup.flipvault.json` on every
  saved change, and use the native share sheet to export annotated PDFs or a printable study
  summary.
- Clearing site data, deleting app data or uninstalling removes the on-device library. Export a
  vault backup first.

## Known limitations

- A planar folded-paper simulation with cylindrical lighting, not a fully deformable 3D mesh; the
  backface is a reflected copy of the artwork with paper shading.
- Encrypted/password-protected PDFs are rejected. There is no OCR, cloud sync or account recovery.
- Search pulses the destination page instead of aligning word overlays, so image-only scans need
  OCR elsewhere.
- Page render resolution is capped for memory safety on midrange phones; smoothness depends on the
  device and the document.
- Physical-device install and reading behaviour are not covered by automated tests.

## More information

- [README](https://github.com/jojokundesu/pdf-reader/blob/{{BRANCH}}/README.md) — full feature list,
  architecture and development commands.
- [Android signing guide](https://github.com/jojokundesu/pdf-reader/blob/{{BRANCH}}/docs/android-signing.md) —
  how the signing key is kept, backed up and verified, and what to do about legacy preview builds.
