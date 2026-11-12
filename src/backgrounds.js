// Reader artwork.
//
// Backgrounds are ordinary images the reader chooses: one for the library,
// one for the reading room, or both. Everything is validated here so a file
// that would look muddy or badly stretched on a phone is refused instead of
// being stored, and images are re-encoded at a sane size before they go into
// IndexedDB.

export const ART_RULES = {
  // A phone at 3x needs roughly 1080 px across; below 800 px a cover-cropped
  // background turns visibly soft, so anything smaller is rejected.
  minSide: 800,
  // Wider or taller than this and a cover crop throws away most of the art.
  minAspect: 0.42,
  maxAspect: 2.4,
  maxBytes: 12 * 1024 * 1024,
  // Stored copies are re-encoded to this long edge.
  maxEdge: 2000,
};

const megabytes = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function validateArtwork({ width, height, bytes = 0, name = "That image" }) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !width || !height)
    throw Error("That file is not an image this device can read.");
  if (bytes > ART_RULES.maxBytes)
    throw Error(`${name} is ${megabytes(bytes)}. Choose an image under 12 MB.`);
  if (width < ART_RULES.minSide || height < ART_RULES.minSide)
    throw Error(
      `${name} is ${width} × ${height}. Backgrounds need at least ${ART_RULES.minSide} × ${ART_RULES.minSide} px so they stay sharp on a phone.`,
    );
  const aspect = width / height;
  if (aspect < ART_RULES.minAspect || aspect > ART_RULES.maxAspect)
    throw Error(
      `${name} is ${width} × ${height}. That shape is too ${aspect < 1 ? "tall" : "wide"} for the screen — a background is cropped to fill it.`,
    );
  return { width, height, aspect };
}

function drawScaled(bitmap) {
  const longEdge = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, ART_RULES.maxEdge / longEdge);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  return { canvas, width, height };
}

// Reads a picked file, checks it, and returns a stored-size JPEG data URL.
export async function readArtworkFile(file) {
  if (!file) throw Error("No image was chosen.");
  if (file.type && !file.type.startsWith("image/"))
    throw Error("Choose a JPG, PNG or WebP image.");
  if (file.size > ART_RULES.maxBytes)
    throw Error(
      `${file.name || "That image"} is ${megabytes(file.size)}. Choose a file under 12 MB.`,
    );
  const bitmap = await createImageBitmap(file);
  try {
    validateArtwork({
      width: bitmap.width,
      height: bitmap.height,
      bytes: file.size,
      name: file.name || "That image",
    });
    const { canvas, width, height } = drawScaled(bitmap);
    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.86),
      width,
      height,
    };
  } finally {
    bitmap.close?.();
  }
}

export function artworkFromCanvas(canvas, name = "PDF artwork") {
  validateArtwork({ width: canvas.width, height: canvas.height, name });
  const { canvas: scaled, width, height } = drawScaled(canvas);
  return {
    dataUrl: scaled.toDataURL("image/jpeg", 0.86),
    width,
    height,
  };
}

export function newArtwork({ dataUrl, width, height, name }) {
  return {
    id: `art-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: String(name || "Artwork").slice(0, 60),
    dataUrl,
    width,
    height,
    addedAt: Date.now(),
  };
}

// Chosen artwork for one surface ("home" or "reader").
// A surface with nothing chosen stays plain, so art picked for the library
// does not leak into the reading room (or the other way round). Rotation only
// applies once a surface has art, and then it walks the whole library.
export function pickArtwork(library, surface, previousId = null) {
  const images = library?.images || [];
  const chosen = library?.[surface];
  if (!images.length || !chosen) return null;
  if (!library.rotate) return images.find((i) => i.id === chosen) || null;
  const options =
    images.length > 1 ? images.filter((i) => i.id !== previousId) : images;
  return options[Math.floor(Math.random() * options.length)] || null;
}

export const EMPTY_LIBRARY = { images: [], home: null, reader: null, rotate: false };
