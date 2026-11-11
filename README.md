# FlipVault Pro

An offline-first reader for Android, with real canvas page folds, non-destructive highlighting and a private on-device library for PDFs, ebooks, text and comics.

**[Download for Android](https://github.com/jojokundesu/pdf-reader/releases/latest/download/FlipVault-Pro-Android.apk)** — free APK, no account, works offline after install.

| Platform                      | Status                                     |
| ----------------------------- | ------------------------------------------ |
| Android phones                | **Available now** — download the APK above |
| iPhone / iOS                  | Coming soon                                |
| Windows, macOS, Linux desktop | Coming soon                                |

Install the APK, open the app, and tap **+** to add your PDFs. Updates install over the existing app and keep your books, notes and reading positions — no uninstall needed.

## What it does

- **Turn pages by dragging anywhere** on a page, not just the corners. A deliberate drag or a short flick turns the page; corner peels still work. Pinch zoom, spread layout and right-to-left reading are included.
- **Mark up without damaging the file.** Six marker colours, adjustable brush size and opacity, straight-line mode, precision and whole-stroke erasers, and per-page undo/redo.
- **Paperclip bookmarks** with notes, full-book bookmark tabs and a notes drawer.
- **Full-text search** with snippets, plus a thumbnail filmstrip that flags annotated pages.
- **Focus mode** with an always-visible reader toolbar, a touch-friendly tools panel for markers, erasers, bookmarks, zoom and sound, plus optional page thumbnails. A first-use guided tour can be replayed any time from Help. Reading-time estimates, a 20-minute reading ritual and a floating reference view are included.
- **Pure black background** by default, with charcoal, forest and warm-brown alternatives, plus paper, sepia, AMOLED and e-ink page themes.
- **Your data stays yours:** no account, no analytics, no cloud sync, no network requests. Export annotated PDFs or a printable study summary, and back up notes and positions to a `.flipvault.json` vault.

The first launch creates a 12-page sample book locally, so the reader is usable straight away. Tap **+** to import a PDF or supported EPUB, MOBI/AZW, CBZ/CBR, DjVu, TXT or HTML book. Non-PDF formats are converted on-device; see the 1.4.0 candidate notes for reflow and image-format limits.

## Keep your notes safe

The app stores your PDFs, annotations and reading positions on the device. A vault backup holds annotations and positions but **not** the book files themselves, so keep your originals and re-import them after a restore — their source fingerprints reattach saved notes, including for supported books converted to the reader’s internal page format. Export a vault from the shield button before clearing app data or uninstalling. On Android, enabling auto-backup writes a fresh copy to `Documents/FlipVault/` on every saved change. PDFs and vaults are stored unencrypted, so keep backups somewhere you trust.

## Updates

Releases are published from the `main` branch. Each one is signed with a permanent signing key held in GitHub Actions secrets, and the certificate is verified before anything is published — so an update installs over the previous version without uninstalling. The download link above always points to the newest release, and the release page lists what is included and how to use it.

Older preview builds were signed with temporary debug keys. Android cannot update those in place: uninstall one of them once, install the release above, then restore your vault and re-import your PDFs. Do that only after exporting a backup. Details are in [docs/android-signing.md](docs/android-signing.md).

## 1.4.0 candidate · ready for review

This is a review build on a separate branch, **not a stable release**. The Android download above remains the last approved release until the changes here are tested and explicitly approved. The optional **FlipVault Preview** APK is a separate install with its own library; it cannot replace or update FlipVault Pro.

- **Smoother reading on mid-range phones:** bounded canvas memory, a 3.2-megapixel render budget on lower-memory devices, duplicate-render coalescing, and a capped 1.6× device-pixel ratio on phones to reduce heat and battery use while preserving crisp page turns. System reduced-motion preferences skip the spring animation.
- **Select, copy and share page text:** turn on **Select text**, drag across selectable PDF text, then use the contextual Copy or Share actions. The same tool is available in the focus-mode Reader tools panel.
- **More books, imported privately:** PDF, EPUB, MOBI/AZW/AZW3, CBZ/CBR, DjVu/DJV, TXT and HTML/HTM can be added from device storage. Conversion is performed on-device with no upload. EPUB/MOBI/AZW text is reflowed into simple pages; HTML scripts and remote resources are not run or fetched. Comic pages are sorted naturally by filename. DjVu and comic pages are raster pages.
- **Better offline reading language support:** imported text embeds Noto Sans Latin, Bengali, Devanagari, Tamil and Telugu fonts; PDFs with selectable text keep their source text and layout.
- **Regression coverage:** verified TXT/EPUB Unicode imports, comic archive ordering, text selection and copy/share controls, focus-mode access, and the existing reader, vault and export flows.

**Import boundaries:** non-PDF source files are limited to 250 MB; ZIP/RAR expansions are capped at 500 MB, comics at 1,000 pages, DjVu at 2,000 pages and text reflow at 4 million characters. DRM-protected books and password-protected archives/PDFs are not supported. EPUB/MOBI styling, embedded illustrations, audio/video and interactive elements are not retained during text reflow. DjVu and comic pages are page images (no OCR). Files are converted for reading; the original non-PDF source is not stored. Search and text selection work on real text-based PDFs and reflowed text imports, not image-only pages. Reflowed text currently embeds Latin, Bengali, Devanagari, Tamil and Telugu fonts; glyphs in other writing systems may be replaced.

Found an issue or want a format or tool considered? Open an issue in this repository. FlipVault has no telemetry or cloud sync, so reports are only received when you choose to send them.

## For developers

```sh
npm ci
npm run dev        # development server on 0.0.0.0
npm test           # geometry, storage and signing unit tests
npm run build      # production bundle and offline service worker
npx cap sync android && cd android && ./gradlew :app:assembleRelease
```

The web build runs in any current browser and can be installed from the browser menu. The Android app packages the same reader, so no connection is needed for reading. Automated tests cover page-turn gestures, annotation tools, search, backup and restore, offline reload, PDF export and a synthetic 1,000-page import. Android release builds are compiled in CI, and the signing certificate is checked before anything is published.

Apache-2.0. PDF.js, pdf-lib, JSZip, the MOBI and DjVu/RAR readers, Lucide and Capacitor retain their own licenses. Embedded Noto Sans fonts are OFL-1.1; the license is included in `public/licenses/Noto-Sans-OFL.txt`.
