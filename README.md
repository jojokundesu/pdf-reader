# FlipVault Pro

An offline PDF reader for Android and the web, with canvas page folds, non-destructive highlights, paperclip bookmarks, and an on-device library.

**[Download for Android](https://github.com/jojokundesu/pdf-reader/releases/latest/download/FlipVault-Pro-Android.apk)** — the installable `FlipVault-Pro-Android.apk` from the latest release.

| Platform | Status |
| --- | --- |
| Android | Available now |
| iPhone / iOS | Coming soon |
| Windows / macOS / Linux | Coming soon |

The web app also runs in any modern browser — see [For developers](#for-developers).

## What it does

- **Grab anywhere in Read mode:** tap/hold the middle, upper or lower area of a page, then drag horizontally. Drag left for next and right for previous; Manga mode reverses this. The direction follows your movement, not which half you touched. Both leaves of a desktop spread accept the gesture.
- **No accidental flips:** a stationary hold and a vertical movement do nothing. Tiny interior drags spring back. A deliberate drag of roughly 22% of the displayed page width, or a short brisk flick, completes the turn. Corner/edge peels still use their original fold-progress threshold.
- **Fast flick reliability:** releasing before the next page's composite finishes preparing no longer drops the gesture. Adding a second finger cancels a pending peel and lets pinch zoom take over. Native long-press menus are suppressed on the reading surface.
- **Pure black by default:** the complete reader surround starts at `#000000`, without the old ambient green/brown tint. Existing libraries with no background preference also receive this default; their PDFs and notes are unchanged.
- **Independent background options:** open the sun/theme button → **Reader background** for Pure black, Charcoal, Forest, or Warm brown. The choice is saved across books and app restarts. It does not invert, recolor or re-render your PDF. Original paper, Sepia, AMOLED page filtering and E-ink remain separate choices. The image-preservation preference now also survives restarts.
- **Touch and performance polish:** toolbar menus toggle closed on a second tap and remain within the screen; curl pointer updates are batched to animation frames, and temporary curl snapshots are released after a turn or cancellation. The Android startup, status and navigation backgrounds are black, too.

Select the **hand / Read** tool for anywhere-grab turns. With a marker/eraser selected, a one-finger interior drag still edits ink; use edge gestures, the on-screen arrows or two-finger navigation to turn pages. Above 100% zoom, a one-finger drag pans instead of flipping; return to 100% or use the navigation arrows to turn.

- PDF import via file picker or desktop drop; content-derived SHA-256 identification; multiple-book bookshelf; exact last-book/page restoration.
- Perpendicular-bisector fold geometry, spine constraints, reflected translucent backface, crease/specular/cast shadows, velocity-sensitive completion and critically damped spring return. No `rotateY` door animation.
- Independent PDF, multiply/screen ink, and paperclip UI layers. Marker strokes use a temporary full-opacity buffer and apply alpha only once per stroke.
- Six marker colors and custom picker; 8/18/32 px presets and 4–60 px brush; 15–70% opacity; straight-line toggle and 350 ms hold-to-straighten.
- Precision pixel eraser (10–80 px), whole-stroke eraser, per-page 60-step in-session undo/redo, confirmed clear, keyboard shortcuts.
- Six paperclip finishes, top/right/bottom placement, draggable edge positions, editable notes, full-book bookmark tabs and a notes drawer.
- PDF.js full-text search with snippets and a destination-page pulse; lazy WebP thumbnail filmstrip with annotation/bookmark indicators.
- Original, sepia, AMOLED and e-ink themes; auto/single/spread layouts; RTL controls; 1–4× pinch/wheel/double-click zoom; zoomed-page panning; edge and keyboard navigation while marking.
- Quiet focus mode with idle HUD hiding, accessible exit, reading-time/remaining-time estimates, a 20-minute reading ritual, and independently navigable floating reference view.
- Annotated PDF export with multiply-blended highlights; printable PDF summary of marked pages; native Android share/save sheet.
- Bundled compatibility-build PDF worker, standard fonts and CMaps; no analytics, account, external fonts or remote services.

The first launch generates a 12-page vector PDF, **The art of paying attention**, locally. The sample book is created locally. Use **+** to import your own PDFs.

## Keep your notes safe

1. **Device library:** IndexedDB `FlipVaultDB` stores the original PDF binaries and separate reading states. The app requests persistent storage where supported. Progress and edits are debounced and saved on visibility changes.
2. **External vault:** Download a `.flipvault.json` backup from the shield button. Desktop browsers supporting the File System Access API can link a `.flipvault` file for automatic metadata syncing, or reopen an existing file to restore and relink. **Android APK:** enable Android auto-backup to write `Documents/FlipVault/Auto-backup.flipvault.json` on every saved change. Native PDF/backup exports use the Android share sheet; choose Files/Drive or another destination.
3. **Portable study copies:** Export an annotated PDF or a printable study summary.

**Storage and recovery:** Clearing all site data removes IndexedDB and permissions, even with persistent storage. Vaults contain annotations/positions, **not PDF binaries**. Keep your original PDFs, restore a vault from the shield button, and re-import your PDFs. Their hashes reattach the saved notes even if filenames changed. Android app-data deletion/uninstallation has similar consequences; explicitly saved external backups are the recovery mechanism. File handles require relinking after reopening; unsupported browsers use manual downloads instead of automatic file syncing.

Native auto-backup targets the OS Documents directory using scoped storage. It must be opted into and successful writes depend on the Android version and filesystem permissions. Export a manual vault too before clearing app data or uninstalling. Normal compatible signed updates should preserve app data. The old temporary-key previews have a separate migration limitation; **do not uninstall without an external backup and a usable replacement**. See [Android signing](docs/android-signing.md).

## Updates

Version 1.2.0 uses Android version code **4**. Android updates must retain the application ID (`com.flipvault.pro`) and signing certificate, with a higher version code for each release. The release workflow checks the keystore against a pinned SHA-256 certificate fingerprint and independently verifies the signed APK before publication. Missing signing configuration produces an unsigned verification artifact; invalid configuration blocks publication. The build never generates a replacement release key.

The current release configuration uses GitHub Actions secrets for the private keystore and passwords, plus a repository variable for the public certificate fingerprint. See [Android signing](docs/android-signing.md) for private-key setup, backup, and continuity checks.

A push to `main` runs the full test suite, the browser/offline/large-document suites and the Android build. When a persistent signing key is configured, the workflow also publishes a release containing `FlipVault-Pro-Android.apk`, the web build and the public certificate fingerprint. The release page carries the app description and usage guide from [docs/release-notes.md](docs/release-notes.md), so the download page explains what the app is and how to use it. Without signing configuration the same workflow produces only an unsigned verification artifact and publishes no release.

Legacy debug previews used temporary signing keys that were not retained. They cannot receive an in-place update signed by a new key. Export a vault backup and keep the original PDFs before migrating; a vault does not contain PDF files. The separate **FlipVault Preview** package can be installed without removing the original app, but has independent storage: [Download FlipVault Preview 1.2.0](https://github.com/jojokundesu/pdf-reader/releases/download/side-preview-6bec6cc/FlipVault-Pro-1.2.0-side-by-side-preview.apk) (`com.flipvault.pro.preview`, temporary debug-signed, not the main-app update channel).

## Future updates

- **iPhone / iOS** and **Windows / macOS / Linux** builds are planned; the web app already runs in any modern browser.
- New signed Android releases will appear automatically on the [releases page](https://github.com/jojokundesu/pdf-reader/releases) and through the download link at the top of this page.

## For developers

- **Browser:** `npm ci && npm run dev`. Open the displayed URL. For an offline/installable production app, run `npm run build && npm run preview`.
- **Static hosting:** Unzip the web release onto an HTTPS static host. For GitHub Pages, enable **Settings → Pages → Source: GitHub Actions**, then deploy the subpath production build through a Pages workflow. The expected URL is `https://jojokundesu.github.io/pdf-reader/`. Pages must be enabled by a repository administrator. On Android Chrome, a hosted app can also be installed using the browser menu → **Add to home screen → Install**. The APK includes the complete reader and PDF engine, so no hosted website or internet connection is needed for reading.

### Architecture & performance

| Module | Responsibility |
| --- | --- |
| `src/geometry.js` | Half-plane clipping, reflection matrix, spine clamping |
| `src/gestures.js` | Horizontal intent, displacement-based interior grabs, swipe completion rules |
| `src/curl.js` | Canvas fold pipeline and spring animation |
| `src/page-audio.js` | Bundled MP3 playback, gesture unlocking, single-buffer reuse, fades and mute lifecycle |
| `src/annotations.js` | Vector strokes, isolated buffers, dual erasure and history |
| `src/storage.js` | IndexedDB, sampled SHA-256 fingerprints, validated sidecars, native export |
| `src/main.js` | PDF virtualization, gestures, reader UI, search, backup and export |
| `src/demo.js` | Generated vector sample book |
| `vite.config.js` | Split bundles, bundled PDF resources, versioned offline precache |
| `android/` | Capacitor Android shell and native filesystem/share integration |

High-resolution PDF canvases are cached only within `currentPage ± 2`. Individual page renders are capped at 4.5 million pixels, at most 2× device-pixel ratio, and 3× rerender scale; CSS allows 4× viewing. This intentionally favors memory safety over unlimited raster resolution on midrange Android hardware. Thumbnails are rendered only when intersecting the filmstrip viewport. Frame rate depends on the device and PDF.

### Practical scope notes

- This is a planar folded-paper simulation with cylindrical lighting, not a fully deformable 3D conical mesh. The backface shows reflected, translucent artwork.
- Dark mode filters the page. **Preserve images** preserves the entire original page's colors against an AMOLED surround; it does not perform semantic image segmentation.
- Spread mode shows the preceding page beside the active page. Tap the left leaf to make it active for annotation. The cover is single-page. Turns advance the active page one at a time.
- Search pulses the destination page rather than aligning individual word overlays on scanned/rotated text. Image-only scans need OCR outside this app.
- Undo/redo histories are per page during the running session; resulting ink persists across restarts. The app does not retain undo history after it closes.
- ETA is based on elapsed reading time and pages traversed, not document analysis or eye tracking.
- PDF export rasterizes highlight ink and prints paperclip labels using PDF standard text; Unicode labels outside that font are replaced in the export, while their originals remain intact in the vault. Original PDF content remains vector.
- Encrypted/password-protected PDFs are rejected with an error. OCR, cloud synchronization, and account recovery are not supported.
- Browser integration is tested in headless Chromium at desktop and 393×830 mobile viewports. Android release builds and instrumentation tests are compiled in CI; unsigned verification artifacts are not installable. Signed publication remains gated on maintainer-configured persistent signing secrets. A synthetic 1,000-page text PDF import/random-navigation smoke test also passes at mobile viewport size; this is not a benchmark of an image-heavy novel. Physical Realme 9i testing has not been performed. Keep Android System WebView updated; the PDF compatibility build includes polyfills for older mobile engines.

### Development

Node.js 22+ is recommended.

```sh
npm ci
npm run dev                         # binds 0.0.0.0 for network access
npm test                            # geometry + storage + hostile-backup validation
npm run build                       # production bundle and offline shell
npm run preview -- --port 4173
TEST_URL=http://localhost:4173 TEST_OFFLINE=1 npm run test:e2e
TEST_URL=http://localhost:4173 npm run test:update
TEST_URL=http://localhost:4173 TEST_OFFLINE=1 npm run test:audio
npm run test:large                   # synthetic 1,000-page import/navigation
npx cap sync android                # rebuild web assets first
cd android && ./gradlew :app:assembleRelease  # unsigned unless persistent signing is configured
```

The integration suite includes actual browser touch-event tests for interior long-press drags on either half and either spread leaf, RTL, canceled/tiny/vertical gestures, rapid release during preparation, pure-black pixels, all background choices and preference restoration. It also covers import, drawing, PDF-layer integrity, undo/redo, erasing, paperclips, reload restoration, full-text search, backup/download/restore, valid PDF export, mobile corner drag, focus exit, and offline reload. The bundled Chromium test helper extracts its Linux runtime libraries from the npm package, avoiding an extra browser-download dependency. `CHROME_PATH` may specify an installed Chromium.

`BASE_PATH=/pdf-reader/ npm run build` creates a GitHub Pages-compatible build. Do not use that subpath build inside the Android shell; Android uses the default `/` base.

### Security & privacy

Backups are validated before writing any restored states, including allowed tools, colors, point coordinates and clip identifiers. PDF buffers are copied before passing to PDF.js workers to avoid detaching persisted binaries. Annotation objects are not sent over the network. Export files may contain sensitive reading notes; keep them in a location you trust. PDFs and vaults are not encrypted at rest by FlipVault. The original reference video is retained in the repository and is not bundled into the application.

Licensed under the repository's Apache-2.0 license. PDF.js, pdf-lib, Lucide, Capacitor and other dependencies retain their own licenses.
