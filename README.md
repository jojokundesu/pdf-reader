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

- **Turn pages by dragging anywhere** on a page, not just the corners. A deliberate drag or a short flick turns the page; corner peels still work. Pinch or double-tap to zoom, with spread layout and right-to-left reading included.
- **Select text the standard way.** Press and hold a word to select it, keep dragging to extend the selection, then use the app's own bar to **Highlight** (saved per book, and drawn into exported PDFs), copy, translate, comment or look up the **Meaning** in a built-in offline English dictionary with definitions, synonyms and examples. Android's native copy/translate popup is suppressed so the bar is never covered.
- **Paperclip bookmarks** with notes, full-book bookmark tabs and a notes drawer.
- **Full-text search** that marks the exact word on the page, with snippets, match counting and a thumbnail filmstrip that flags annotated pages.
- **Your library first:** the app opens on the bookshelf with covers, progress and a Continue-reading card, and only shows the guided tour on the very first launch. A brief minimise returns you to the same page, and the reference split view can be dragged, resized and closed.
- **Reader tools in the top bar:** find, reader tools and exit focus are icon buttons, and the tools panel carries layout, theme, background, page thumbnails, go to page, bookmarks, reference, sound, the reading timer, fullscreen, the guide and the library. There is no three-dot menu and there are no arrows beside the page — swipe, use the arrow keys, or type a page number. Reading-time estimates and a 20-minute reading ritual are included.
- **Reading-room backgrounds, built in.** Choose one of the eleven artwork backgrounds that ship inside the app — nine reading rooms for the library, two wooden desks behind the pages — or add your own image or a PDF page. Keep one fixed or let **Advanced** change it each time the app opens, and dim the artwork so text stays readable. Anything smaller than 800 × 800 px, or too wide or tall, is refused with the reason.
- **Pure black surroundings** by default, with charcoal, forest and warm-brown alternatives, plus paper, sepia, aged cream, mocha, slate night, AMOLED dark and e-ink page themes for night reading.
- **Your data stays yours:** no account, no analytics, no cloud sync, no network requests. Export annotated PDFs or a printable study summary, and back up notes and positions to a `.flipvault.json` vault.

The first launch creates a 12-page sample book locally, so the reader is usable straight away. Tap **+** to import a PDF or supported EPUB, MOBI/AZW, CBZ/CBR, DjVu, TXT or HTML book. Non-PDF formats are converted on-device; see the 1.6.0 candidate notes for reflow and image-format limits.

## Keep your notes safe

The app stores your PDFs, annotations and reading positions on the device. A vault backup holds annotations and positions but **not** the book files themselves, so keep your originals and re-import them after a restore — their source fingerprints reattach saved notes, including for supported books converted to the reader’s internal page format. Export a vault from the shield button before clearing app data or uninstalling. On Android, enabling auto-backup writes a fresh copy to `Documents/FlipVault/` on every saved change. PDFs and vaults are stored unencrypted, so keep backups somewhere you trust.

## Updates

Releases are published from the `main` branch. Each one is signed with a permanent signing key held in GitHub Actions secrets, and the certificate is verified before anything is published — so an update installs over the previous version without uninstalling. The download link above always points to the newest release, and the release page lists what is included and how to use it.

Older preview builds were signed with temporary debug keys. Android cannot update those in place: uninstall one of them once, install the release above, then restore your vault and re-import your PDFs. Do that only after exporting a backup. Details are in [docs/android-signing.md](docs/android-signing.md).

## 1.6.0 candidate · ready for review

This is a review build on a separate branch, **not a stable release**. The Android download above remains the last approved release until the changes here are tested and explicitly approved. The optional **FlipVault Preview** APK is a separate install with its own library; it cannot replace or update FlipVault Pro.

- **Selection is the standard long-press-and-drag.** Hold a word to select it, drag to extend the selection word by word, and the app's own bar offers **Highlight** alongside copy, translate, comment and share. Highlights persist with the book, survive reloads and are baked into exported PDFs. The marker and eraser tools - and the zoom +/- buttons with their percentage readout - are gone; pinch and double-tap are the whole zoom story.
- **Meaning, offline:** the new action looks selected words up in a dictionary bundled with the app (146,000 English headwords, definitions, synonyms and examples). It never calls the network, and it is English-only for now.
- **Android's own copy/translate popup no longer covers the app bar.** Selection is handled by the reader itself, so the actions you see are the actions that work.
- **The library is the front door:** books, covers, progress and a Continue-reading card come first, the guided tour appears only on a true first launch, and a WebView reload after a brief minimise reopens the book where you left it.
- **Focus mode fits a phone:** the reader tools panel now carries layout, theme and page position, thumbnails can be toggled, and every control stays on screen.
- **Reader options in one place:** find, reader tools and exit focus are icon buttons in the top bar, the three-dot menu is gone, and the arrows beside the page are gone — page turns are swipes, arrow keys or a typed page number. The thumbnail strip follows the page you are reading.
- **Reading-room artwork ships with the app:** the eleven backgrounds taken from the two artwork sheets are bundled inside the APK, so they work offline with no import. Pick one for the library, the reading room or both, keep it fixed or change it on every launch, and dim it so text stays readable. Uploaded artwork is checked before it is stored — anything under 800 × 800 px, too wide or too tall is refused with the reason.
- **Night reading is easier on the eyes:** Warm parchment is no longer a bright white page, and the dark side now has Dark cream (warm brown paper), Mocha, Slate night (cool blue-grey) and AMOLED dark alongside e-ink contrast.
- **Reference split view fixes:** drag it by its header, resize it from the corner grip, minimise or close it - it no longer stays stuck on top until a restart.
- **More books, imported privately:** PDF, EPUB, MOBI/AZW/AZW3, CBZ/CBR, DjVu/DJV, TXT and HTML/HTM can be added from device storage. Conversion is performed on-device with no upload. EPUB/MOBI/AZW text is reflowed into simple pages; HTML scripts and remote resources are not run or fetched. Comic pages are sorted naturally by filename. DjVu and comic pages are raster pages.
- **Better offline reading language support:** imported text embeds Noto Sans Latin, Bengali, Devanagari, Tamil and Telugu fonts; PDFs with selectable text keep their source text and layout.
- **Regression coverage:** verified TXT/EPUB Unicode imports, comic archive ordering, text selection and copy/share controls, focus-mode access, and the existing reader, vault and export flows.

**Import boundaries:** non-PDF source files are limited to 250 MB; ZIP/RAR expansions are capped at 500 MB, comics at 1,000 pages, DjVu at 2,000 pages and text reflow at 4 million characters. DRM-protected books and password-protected archives/PDFs are not supported. EPUB/MOBI styling, embedded illustrations, audio/video and interactive elements are not retained during text reflow. DjVu and comic pages are page images (no OCR). Files are converted for reading; the original non-PDF source is not stored. Search and text selection work on real text-based PDFs and reflowed text imports, not image-only pages. Reflowed text currently embeds Latin, Bengali, Devanagari, Tamil and Telugu fonts; glyphs in other writing systems may be replaced.

Found an issue or want a format or tool considered? Open an issue in this repository. FlipVault has no telemetry or cloud sync, so reports are only received when you choose to send them.

## For developers

```sh
npm ci
npm run dev        # development server on 0.0.0.0 (builds the dictionary first)
npm test           # geometry, storage, selection and signing unit tests
npm run dictionary # rebuild public/dictionary from WordNet (git-ignored, ~25 MB)
npm run build      # production bundle and offline service worker
npm run android:sync   # build, then copy the web assets + plugins into android/
cd android && ./gradlew :app:assembleRelease
```

The offline dictionary is generated at build time from the `wordnet` dev dependency into `public/dictionary/`, so it is never committed. `npm run dev` and `npm run build` run the generator automatically; run `npm run dictionary` by hand only after changing the generator. After `npm install` adds or updates a Capacitor plugin (for example `@capacitor/app`, which handles Android resume and "Open with" links), `npm run android:sync` must run before building the APK, otherwise the native project keeps the old plugin list.

The web build runs in any current browser and can be installed from the browser menu. The Android app packages the same reader, so no connection is needed for reading. Automated tests cover page-turn gestures, text selection and highlighting, search-hit alignment, dictionary lookup, the library and resume flows, backup and restore, offline reload, PDF export and a synthetic 1,000-page import. Android release builds are compiled in CI, and the signing certificate is checked before anything is published.

Apache-2.0. PDF.js, pdf-lib, JSZip, the MOBI and DjVu/RAR readers, Lucide and Capacitor retain their own licenses. Embedded Noto Sans fonts are OFL-1.1; the license is included in `public/licenses/Noto-Sans-OFL.txt`.
