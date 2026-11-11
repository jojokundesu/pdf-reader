// Runtime loader for the generated dictionary chunks in /dictionary/*.json.
// They are served as static assets (web) and packaged inside the APK, so the
// dictionary works offline without inflating the JavaScript bundle.
const cache = new Map();
const base = import.meta.env.BASE_URL || "/";

export async function loadDictionaryChunk(letter) {
  const key = /^[a-z]$/.test(letter) ? letter : "_";
  if (cache.has(key)) return cache.get(key);
  const promise = fetch(`${base}dictionary/${key}.json`)
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);
  cache.set(key, promise);
  return promise;
}
