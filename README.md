# FlipVault Pro

An offline PDF reader for Android, with real canvas page folds, non-destructive highlighting and a library that stays on your device.

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

The first launch creates a 12-page sample book locally, so the reader is usable straight away. Tap **+** to import your own PDFs.

## Keep your notes safe

The app stores your PDFs, annotations and reading positions on the device. A vault backup holds annotations and positions but **not** the PDF files themselves, so keep your original PDFs and re-import them after a restore — their content hashes reattach your saved notes. Export a vault from the shield button before clearing app data or uninstalling. On Android, enabling auto-backup writes a fresh copy to `Documents/FlipVault/` on every saved change. PDFs and vaults are stored unencrypted, so keep backups somewhere you trust.

## Updates

Releases are published from the `main` branch. Each one is signed with a permanent signing key held in GitHub Actions secrets, and the certificate is verified before anything is published — so an update installs over the previous version without uninstalling. The download link above always points to the newest release, and the release page lists what is included and how to use it.

Older preview builds were signed with temporary debug keys. Android cannot update those in place: uninstall one of them once, install the release above, then restore your vault and re-import your PDFs. Do that only after exporting a backup. Details are in [docs/android-signing.md](docs/android-signing.md).

## Future updates

- **Smoother interface** — faster rendering, cleaner animations and lower battery use on mid-range phones.
- **Text selection and copying** — select words and passages from a page and copy or share them.
- **More file formats** — EPUB, MOBI/AZW3, CBZ and CBR comics, DjVu, and plain text or HTML documents alongside PDF.
- **Bug fixes and requested features** — driven by user feedback and issue reports.

Have a request or found a problem? Open an issue in this repository.

## For developers

```sh
npm ci
npm run dev        # development server on 0.0.0.0
npm test           # geometry, storage and signing unit tests
npm run build      # production bundle and offline service worker
npx cap sync android && cd android && ./gradlew :app:assembleRelease
```

The web build runs in any current browser and can be installed from the browser menu. The Android app packages the same reader, so no connection is needed for reading. Automated tests cover page-turn gestures, annotation tools, search, backup and restore, offline reload, PDF export and a synthetic 1,000-page import. Android release builds are compiled in CI, and the signing certificate is checked before anything is published.

Apache-2.0. PDF.js, pdf-lib, Lucide and Capacitor keep their own licenses.
