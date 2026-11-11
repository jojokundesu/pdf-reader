import { Capacitor } from "@capacitor/core";
const request = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
let db;
export async function openDB() {
  db = await new Promise((resolve, reject) => {
    const r = indexedDB.open("FlipVaultDB", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("pdfFiles", { keyPath: "pdfHash" });
      r.result.createObjectStore("readingState", { keyPath: "pdfHash" });
      r.result.createObjectStore("settings");
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return db;
}
export const get = (store, key) =>
  request(db.transaction(store).objectStore(store).get(key));
export const all = (store) =>
  request(db.transaction(store).objectStore(store).getAll());
export function put(store, value, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    key === undefined
      ? tx.objectStore(store).put(value)
      : tx.objectStore(store).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export function remove(store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
export async function fingerprint(buffer) {
  const b = new Uint8Array(buffer),
    size = new TextEncoder().encode(String(b.length)),
    parts = [
      size,
      b.slice(0, 65536),
      b.slice(
        Math.max(0, Math.floor(b.length / 2) - 32768),
        Math.floor(b.length / 2) + 32768,
      ),
      b.slice(Math.max(0, b.length - 65536)),
    ];
  const joined = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    joined.set(p, offset);
    offset += p.length;
  }
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", joined))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export async function download(data, name, type = "application/json") {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const blob = new Blob([data], { type });
    const base64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result.split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const file = await Filesystem.writeFile({
      path: "exports/" + name.replace(/[\\/:*?"<>|]/g, "_"),
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title: name,
      url: file.uri,
      dialogTitle: "Save or share your FlipVault export",
    });
    return;
  }
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export const isNative = () => Capacitor.isNativePlatform();
export async function syncNativeVault(data) {
  const { Filesystem, Directory, Encoding } =
    await import("@capacitor/filesystem");
  await Filesystem.writeFile({
    path: "FlipVault/Auto-backup.flipvault.json",
    data: JSON.stringify(data),
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
}
export async function vaultData() {
  return {
    format: "FlipVault",
    version: 1,
    exportedAt: new Date().toISOString(),
    states: await all("readingState"),
  };
}
export async function restoreVault(data) {
  if (
    data?.format !== "FlipVault" ||
    data.version !== 1 ||
    !Array.isArray(data.states)
  )
    throw Error("This is not a supported FlipVault backup.");
  for (const s of data.states) validateState(s);
  for (const s of data.states) await put("readingState", s);
}

export function validateState(s) {
  const finite = (n) => typeof n === "number" && Number.isFinite(n),
    validColor = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c),
    bad = () => {
      throw Error("Invalid reading state in backup. No changes were restored.");
    };
  if (
    !s ||
    !/^[0-9a-f]{64}$/.test(s.pdfHash) ||
    !Number.isInteger(s.lastPage) ||
    s.lastPage < 1 ||
    !s.pageAnnotations ||
    typeof s.pageAnnotations !== "object" ||
    Array.isArray(s.pageAnnotations) ||
    !Array.isArray(s.paperclips)
  )
    bad();
  if (
    s.zoomLevel !== undefined &&
    (!finite(s.zoomLevel) || s.zoomLevel < 1 || s.zoomLevel > 4)
  )
    bad();
  if (
    s.readingMode !== undefined &&
    !["auto", "single", "spread"].includes(s.readingMode)
  )
    bad();
  if (
    s.theme !== undefined &&
    !["original", "sepia", "dark", "ink"].includes(s.theme)
  )
    bad();
  if (
    s.paperclips.length > 10000 ||
    Object.keys(s.pageAnnotations).length > 10000
  )
    bad();
  for (const c of s.paperclips) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !/^[a-z0-9-]{1,80}$/i.test(c.id) ||
      !Number.isInteger(c.page) ||
      c.page < 1 ||
      !["top", "right", "bottom"].includes(c.edge) ||
      !finite(c.position) ||
      c.position < 0 ||
      c.position > 1 ||
      !validColor(c.color) ||
      typeof c.note !== "string" ||
      c.note.length > 10000 ||
      (c.quote !== undefined &&
        (typeof c.quote !== "string" || c.quote.length > 5000))
    )
      bad();
  }
  for (const [page, strokes] of Object.entries(s.pageAnnotations)) {
    if (
      !/^[1-9][0-9]*$/.test(page) ||
      !Array.isArray(strokes) ||
      strokes.length > 10000
    )
      bad();
    for (const x of strokes) {
      if (
        !x ||
        !["marker", "pixel"].includes(x.tool) ||
        !validColor(x.color) ||
        !finite(x.width) ||
        x.width <= 0 ||
        x.width > 100 ||
        !finite(x.opacity) ||
        x.opacity < 0 ||
        x.opacity > 1 ||
        !Array.isArray(x.points) ||
        x.points.length > 100000 ||
        x.points.some(
          (p) =>
            !p ||
            !finite(p.x) ||
            !finite(p.y) ||
            Math.abs(p.x) > 100000 ||
            Math.abs(p.y) > 100000,
        )
      )
        bad();
    }
  }
  return true;
}
