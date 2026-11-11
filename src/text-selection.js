// Text selection helpers.
//
// The reader never relies on the browser's native text selection: on Android
// WebView the system Copy/Translate popup otherwise covers the app's own
// actions. Selections are built from caret positions and painted by the app,
// so these helpers keep the boundary maths in one testable place.

const WORD = /[\p{L}\p{N}\p{M}_’'-]+/gu;
const SENTENCE_END = /[.!?…]+["'”’)\]]*\s+|\n+/gu;

export function wordBounds(text, offset) {
  const source = String(text ?? "");
  if (!source) return null;
  const at = Math.max(0, Math.min(source.length, offset));
  let found = null;
  for (const match of source.matchAll(WORD)) {
    const start = match.index,
      end = start + match[0].length;
    if (at >= start && at <= end) {
      found = { start, end };
      // Keep looking only while the caret sits exactly on a boundary so the
      // following word can claim a trailing space.
      if (at < end) break;
    }
    if (start > at) break;
  }
  return found;
}

export function sentenceBounds(text, offset) {
  const source = String(text ?? "");
  if (!source) return null;
  const at = Math.max(0, Math.min(source.length, offset));
  let start = 0;
  for (const match of source.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length;
    if (at >= start && at < end) return { start, end };
    start = end;
  }
  return { start, end: source.length };
}

export function sentenceAt(text, offset) {
  const bounds = sentenceBounds(text, offset);
  if (!bounds) return null;
  const slice = String(text).slice(bounds.start, bounds.end);
  const leading = slice.length - slice.trimStart().length;
  const trimmed = slice.trim().length;
  if (!trimmed) return null;
  return { start: bounds.start + leading, end: bounds.start + leading + trimmed };
}

// Rectangles come back in viewport coordinates from Range#getClientRects.
// Store them relative to the page so zooming and resizing never shifts them.
export function relativeRects(rects, pageBox) {
  if (!pageBox?.width || !pageBox?.height) return [];
  return [...rects]
    .filter((rect) => rect.width > 0.5 && rect.height > 0.5)
    .map((rect) => ({
      x: (rect.left - pageBox.left) / pageBox.width,
      y: (rect.top - pageBox.top) / pageBox.height,
      w: rect.width / pageBox.width,
      h: rect.height / pageBox.height,
    }))
    .filter(
      (rect) =>
        rect.w > 0 &&
        rect.h > 0 &&
        rect.x + rect.w > 0 &&
        rect.x < 1 &&
        rect.y + rect.h > 0 &&
        rect.y < 1,
    );
}

// Merge neighbouring line boxes so a selection looks like one clean marker
// stroke instead of a stack of thin rectangles.
export function mergeRects(rects, tolerance = 0.35) {
  if (rects.length < 2) return rects;
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const rect of sorted) {
    const line = lines.find(
      (candidate) =>
        Math.abs(candidate.y - rect.y) < tolerance * Math.max(rect.h, candidate.h),
    );
    if (!line) {
      lines.push({ ...rect });
      continue;
    }
    const right = Math.max(line.x + line.w, rect.x + rect.w);
    line.x = Math.min(line.x, rect.x);
    line.w = right - line.x;
    line.h = Math.max(line.h, rect.h);
  }
  return lines;
}

export function selectionText(range) {
  return (range?.toString() || "").replace(/\s+/g, " ").trim();
}

export function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}
