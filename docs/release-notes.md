# FlipVault Pro {{VERSION}}

A private, offline reading room for Android and the browser. PDF pages retain their source rendering; supported ebooks, text and comic archives are converted locally into page-based reading copies.

> **Review candidate only — 1.6.0 is not published as a stable release.** The 1.4.0 build on `main` stays the approved download until this candidate has been checked on a device and explicitly approved. The optional **FlipVault Preview** APK is a separate install with its own library and cannot update FlipVault Pro.

## What is new in 1.6.0

- **Selection works the way every other reader works.** Press and hold a word and that word is selected; keep dragging and the selection grows word by word. Releasing keeps it, tapping elsewhere clears it, and the double-tap/triple-tap word and sentence shortcuts are gone along with every selection mode switch in the options.
- **Reader options live in one place.** Reader tools now hold layout, theme, background, page thumbnails, go to page, bookmark, reference, sound, timer, fullscreen, guide, tour and library. The top bar is three icons — find, reader tools and exit focus — and the three-dot menu is gone because there is nothing left behind it.
- **No arrows beside the page.** Page turns are swipes, the arrow keys, or typing a page number; the floating left/right arrows, the first/last buttons and the footer chevrons are removed.
- **Thumbnails follow you.** The filmstrip scrolls to keep the page you are reading in view instead of staying parked on page one, in both the desktop footer and the phone filmstrip.
- **Reading-room artwork, included.** The two artwork sheets in the repository ship inside the app as eleven built-in backgrounds — nine reading rooms for the library and two wooden desks for the reading room — so they are available offline and need no import. Choose your own image or a PDF page instead if you prefer; anything under 800 × 800 px, too wide or too tall is refused with the reason. **Advanced** keeps one picture fixed or changes it every time the app is opened, and the artwork can be dimmed so text stays readable.
- **Better dark themes.** Warm parchment was washed out for night reading, so the dark side now has Dark cream (warm, low glare), Mocha, Slate night and AMOLED dark, each with a matching stage tint. The page keeps its own colour; the surround changes.
- **Reading data is backed up as before, and backed up sooner.** The vault still carries how far you read, bookmarks, highlights, paperclips and notes; a page turn is now written within a fraction of a second, so a reload or a crash lands on the page you were actually on.

### What was new in 1.5.0

- **Highlight from text selection.** Select text and choose **Highlight**. Highlights are saved with the book, redrawn after a reload and included in exported PDFs. The marker, eraser, zoom +/-, zoom percentage, duplicate "Search book" and "Read" tools are gone, along with the "Install on your device" menu entry.
- **Meaning, fully offline.** A new selection action looks words up in a dictionary built into the app: 146,000 English headwords with definitions, synonyms and examples. Nothing is fetched from the network. English only for now.
- **The app's own selection bar wins.** Page text is selected by the reader with the native text-selection menu suppressed, so Android's floating Copy/Translate popup can no longer sit on top of Copy, Highlight, Meaning, Translate, Comment and More.
- **Library first.** The app opens on the bookshelf with covers, progress and a Continue-reading card. The welcome tour appears only on a true first launch and closing it retires it for good.
- **Resume after a brief minimise.** Position and progress are saved every time Android pauses the app, and a WebView reload reopens the same book instead of dropping you back to the shelf.
- **Search marks the exact word.** Search overlays are projected from the real text ranges, so a hit is painted on the word it matched and follow-up actions apply to that hit.
- **Focus mode fits a phone.** Reader tools now include layout, theme and page position, keep every button on screen, and no longer hide the three-dot menu behind a dragged layout.
- **Reference split view is usable:** drag it by the header, resize it from the corner grip, minimise it, or close it with its own X. It no longer floats unclosable until the app restarts.
- **Android "Open with" support.** PDFs shared from a file manager, Downloads or a mail attachment can open directly in FlipVault through a new intent filter and content-URI import path.
- **Regression coverage:** the browser suite now exercises select-to-highlight, dictionary lookup, search-hit alignment, first-run library landing, resume-after-reload, reference panel geometry, mobile focus tools and the existing vault, export and import flows, plus new unit coverage for saved highlight validation.

### Import limits to know before testing

- DRM-protected books, password-protected documents and encrypted comic archives are not supported. CBR multi-volume archives are not supported.
- EPUB and MOBI/AZW are reflowed as text. Original CSS/layout, embedded illustrations, audio/video, interactive content and remote assets are intentionally not carried over. Scripts do not run and external resources are never fetched.
- DjVu and comic pages are raster images; they do not gain OCR or selectable text. Search and selection work on text-based PDFs and reflowed text formats, not image-only scans.
- Reflowed text embeds Latin, Bengali, Devanagari, Tamil and Telugu fonts. Glyphs from other writing systems may be replaced.
- Non-PDF source files are converted for the reader and are not retained as originals. Keep a separate copy of your source files.
- The dictionary is English-only and covers common dictionary headwords and inflections; proper nouns, technical jargon and inflected forms outside its word list may return no entry.
- Android "Open with" import has not been verified on a physical device in this candidate; if the chooser entry is missing on your phone, open the app and use **+** to import instead.

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
