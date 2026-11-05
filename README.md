# FlipVault Pro

A private, touch-first PDF reading room. Real 2D canvas page folds, non-destructive highlights, tactile paperclips, and a library that stays on your device.

## What changed in 1.1.0

- **Grab anywhere in Read mode:** tap/hold the middle, upper or lower area of a page, then drag horizontally. Drag left for next and right for previous; Manga mode reverses this. The direction follows your movement, not which half you touched. Both leaves of a desktop spread accept the gesture.
- **No accidental flips:** a stationary hold and a vertical movement do nothing. Tiny interior drags spring back. A deliberate drag of roughly 22% of the displayed page width, or a short brisk flick, completes the turn. Corner/edge peels still use their original fold-progress threshold.
- **Fast flick reliability:** releasing before the next page's composite finishes preparing no longer drops the gesture. Adding a second finger cancels a pending peel and lets pinch zoom take over. Native long-press menus are suppressed on the reading surface.
- **Pure black by default:** the complete reader surround starts at `#000000`, without the old ambient green/brown tint. Existing libraries with no background preference also receive this default; their PDFs and notes are unchanged.
- **Independent background options:** open the sun/theme button → **Reader background** for Pure black, Charcoal, Forest, or Warm brown. The choice is saved across books and app restarts. It does not invert, recolor or re-render your PDF. Original paper, Sepia, AMOLED page filtering and E-ink remain separate choices. The image-preservation preference now also survives restarts.
- **Touch and performance polish:** toolbar menus toggle closed on a second tap and remain within the screen; curl pointer updates are batched to animation frames, and temporary curl snapshots are released after a turn or cancellation. The Android startup, status and navigation backgrounds are black, too.

Select the **hand / Read** tool for anywhere-grab turns. With a marker/eraser selected, a one-finger interior drag still edits ink; use edge gestures, the on-screen arrows or two-finger navigation to turn pages. Above 100% zoom, a one-finger drag pans instead of flipping; return to 100% or use the navigation arrows to turn.

**Updating an older preview:** export a vault backup first and keep your original PDFs. These APKs are debug-signed, and Android can reject an in-place update if the old preview used a different signing key. If you must uninstall it, restore the vault in the new app and re-import your original PDFs to recover matching notes and positions. The new APK's Android version is **1.1.0**, version code **2**.

## Get the app

- **Android:** Download `FlipVault-Pro-Android-preview.apk` from [Releases](https://github.com/jojokundesu/pdf-reader/releases). Android may ask you to allow installation from your browser. This is a sideloadable **debug-signed preview**, not a Play Store release.
- **Browser:** `npm ci && npm run dev`. Open the displayed URL. For an offline/installable production app, run `npm run build && npm run preview`.
- **Static hosting:** Unzip the web release onto an HTTPS static host. For GitHub Pages, enable **Settings → Pages → Source: GitHub Actions**, then run **Build, test & publish FlipVault** from this branch in Actions. The expected URL is `https://jojokundesu.github.io/pdf-reader/`. The repository integration cannot enable Pages on your behalf.

On Android Chrome, a hosted app can also be installed using the browser menu → **Add to home screen → Install**. The APK includes the complete reader and PDF engine, so no hosted website or internet connection is needed for reading.

## Reading & study tools

- PDF import via file picker or desktop drop; content-derived SHA-256 identification; multiple-book bookshelf; exact last-book/page restoration.
- Perpendicular-bisector fold geometry, spine constraints, reflected translucent backface, crease/specular/cast shadows, velocity-sensitive completion and critically damped spring return. No `rotateY` door animation.
- Independent PDF, multiply/screen ink, and paperclip UI layers. Marker strokes use a temporary full-opacity buffer and apply alpha only once per stroke.
- Six marker colors and custom picker; 8/18/32 px presets and 4–60 px brush; 15–70% opacity; straight-line toggle and 350 ms hold-to-straighten.
- Precision pixel eraser (10–80 px), whole-stroke eraser, per-page 60-step in-session undo/redo, confirmed clear, keyboard shortcuts.
- Six paperclip finishes, top/right/bottom placement, draggable edge positions, editable notes, full-book bookmark tabs and a notes drawer.
- PDF.js full-text search with snippets and a destination-page pulse; lazy WebP thumbnail filmstrip with annotation/bookmark indicators.
- Original, sepia, AMOLED and e-ink themes; auto/single/spread layouts; RTL controls; 1–4× pinch/wheel/double-click zoom; zoomed-page panning; edge and keyboard navigation while marking.
- Procedural Web Audio page sounds with mute. Quiet focus mode with idle HUD hiding, accessible exit, reading-time/remaining-time estimates, a 20-minute reading ritual, and independently navigable floating reference view.
- Annotated PDF export with multiply-blended highlights; printable PDF summary of marked pages; native Android share/save sheet.
- Bundled compatibility-build PDF worker, standard fonts and CMaps; no analytics, account, external font, audio or AI service.

The first launch generates a real 12-page vector PDF, **The art of paying attention**, locally. It is a usable sample book, not a remote dependency. Use **+** to import your own PDFs.

## Keep your notes safe

1. **Device library:** IndexedDB `FlipVaultDB` stores the original PDF binaries and separate reading states. The app requests persistent storage where supported. Progress and edits are debounced and saved on visibility changes.
2. **External vault:** Download a `.flipvault.json` backup from the shield button. Desktop browsers supporting the File System Access API can link a `.flipvault` file for automatic metadata syncing, or reopen an existing file to restore and relink. **Android APK:** enable Android auto-backup to write `Documents/FlipVault/Auto-backup.flipvault.json` on every saved change. Native PDF/backup exports use the Android share sheet; choose Files/Drive or another destination.
3. **Portable study copies:** Export an annotated PDF or a printable study summary.

**No browser can make data immortal.** Clearing all site data removes IndexedDB and permissions, even with persistent storage. Vaults contain annotations/positions, **not PDF binaries**. Keep your original PDFs, restore a vault from the shield button, and re-import your PDFs. Their hashes reattach the saved notes even if filenames changed. Android app-data deletion/uninstallation has similar consequences; explicitly saved external backups are the recovery mechanism. File handles require relinking after reopening; unsupported browsers use manual downloads rather than claiming silent automatic backups.

Native auto-backup targets the OS Documents directory using scoped storage. It must be opted into and successful writes depend on the Android version and filesystem permissions. Export a manual vault too before clearing app data or uninstalling. Debug-signed APK updates built on another runner may require uninstalling the old preview; **back up first**.

## Architecture & performance

| Module | Responsibility |
| --- | --- |
| `src/geometry.js` | Half-plane clipping, reflection matrix, spine clamping |
| `src/gestures.js` | Horizontal intent, displacement-based interior grabs, swipe completion rules |
| `src/curl.js` | Canvas fold pipeline and spring animation |
| `src/annotations.js` | Vector strokes, isolated buffers, dual erasure and history |
| `src/storage.js` | IndexedDB, sampled SHA-256 fingerprints, validated sidecars, native export |
| `src/main.js` | PDF virtualization, gestures, reader UI, search, backup and export |
| `src/demo.js` | Generated vector sample book |
| `vite.config.js` | Split bundles, bundled PDF resources, versioned offline precache |
| `android/` | Capacitor Android shell and native filesystem/share integration |

High-resolution PDF canvases are cached only within `currentPage ± 2`. Individual page renders are capped at 4.5 million pixels, at most 2× device-pixel ratio, and 3× rerender scale; CSS allows 4× viewing. This intentionally favors memory safety over unlimited raster resolution on midrange Android hardware. Thumbnails are rendered only when intersecting the filmstrip viewport. No mobile 60 FPS guarantee is claimed without testing the actual PDF and device.

### Practical scope notes

- This is a planar folded-paper simulation with cylindrical lighting, not a fully deformable 3D conical mesh. The backface shows reflected, translucent artwork.
- Dark mode filters the page. **Preserve images** preserves the entire original page's colors against an AMOLED surround; it does not perform semantic image segmentation.
- Spread mode shows the preceding page beside the active page. Tap the left leaf to make it active for annotation. The cover is single-page. Turns advance the active page one at a time.
- Search pulses the destination page rather than aligning individual word overlays on scanned/rotated text. Image-only scans need OCR outside this app.
- Undo/redo histories are per page during the running session; resulting ink persists across restarts. The app does not retain undo history after it closes.
- ETA is based on elapsed reading time and pages traversed, not an AI estimate or eye tracking.
- PDF export rasterizes highlight ink and prints paperclip labels using PDF standard text; Unicode labels outside that font are replaced in the export, while their originals remain intact in the vault. Original PDF content remains vector.
- Encrypted/password-protected PDFs are rejected with an error. No OCR, cloud synchronization, or account recovery is implied.
- Browser integration is tested in headless Chromium at desktop and 393×830 mobile viewports. Android builds are assembled in CI. A synthetic 1,000-page text PDF import/random-navigation smoke test also passes at mobile viewport size; this is not a benchmark of an image-heavy novel. Physical Realme 9i testing has not been performed. Keep Android System WebView updated; the PDF compatibility build includes polyfills for older mobile engines.

## Development

Node.js 22+ is recommended.

```sh
npm ci
npm run dev                         # binds 0.0.0.0, permits Arena preview hosts
npm test                            # geometry + storage + hostile-backup validation
npm run build                       # production bundle and offline shell
npm run preview -- --port 4173
TEST_URL=http://localhost:4173 TEST_OFFLINE=1 npm run test:e2e
TEST_URL=http://localhost:4173 npm run test:update
npm run test:large                   # synthetic 1,000-page import/navigation
npx cap sync android                # rebuild web assets first
cd android && ./gradlew assembleDebug
```

The integration suite includes actual browser touch-event tests for interior long-press drags on either half and either spread leaf, RTL, canceled/tiny/vertical gestures, rapid release during preparation, pure-black pixels, all background choices and preference restoration. It also covers import, drawing, PDF-layer integrity, undo/redo, erasing, paperclips, reload restoration, full-text search, backup/download/restore, valid PDF export, mobile corner drag, focus exit, and offline reload. The bundled Chromium test helper extracts its Linux runtime libraries from the npm package, avoiding an extra browser-download dependency. `CHROME_PATH` may specify an installed Chromium.

`BASE_PATH=/pdf-reader/ npm run build` creates a GitHub Pages-compatible build. Do not use that subpath build inside the Android shell; Android uses the default `/` base.

## Security & privacy

Backups are validated before writing any restored states, including allowed tools, colors, point coordinates and clip identifiers. PDF buffers are copied before passing to PDF.js workers to avoid detaching persisted binaries. Annotation objects are not sent over the network. Export files may contain sensitive reading notes; keep them in a location you trust. PDFs and vaults are not encrypted at rest by FlipVault. The original reference video is retained in the repository and is not bundled into the application.

Licensed under the repository's Apache-2.0 license. PDF.js, pdf-lib, Lucide, Capacitor and other dependencies retain their own licenses.
