// Offline dictionary lookups. Data lives in ./dictionary/*.json (generated at
// build time from WordNet) and is loaded one letter at a time, so the reader
// never pays for 146,000 words it will not look up.

export function normalizeWord(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’']s\b/g, "")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .trim();
}

// English inflections WordNet does not always index as headwords.
export function wordForms(value) {
  const word = normalizeWord(value);
  if (!word) return [];
  const forms = new Set([word]);
  const add = (candidate) => candidate && forms.add(candidate);
  if (word.endsWith("ies") && word.length > 4) add(word.slice(0, -3) + "y");
  if (word.endsWith("es") && word.length > 3) add(word.slice(0, -2));
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3)
    add(word.slice(0, -1));
  if (word.endsWith("ied")) add(word.slice(0, -3) + "y");
  if (word.endsWith("ed")) {
    add(word.slice(0, -2));
    add(word.slice(0, -1));
    if (/([b-df-hj-np-tv-z])\1ed$/.test(word)) add(word.slice(0, -3));
  }
  if (word.endsWith("ing")) {
    add(word.slice(0, -3));
    add(word.slice(0, -3) + "e");
    if (/([b-df-hj-np-tv-z])\1ing$/.test(word)) add(word.slice(0, -4));
  }
  if (word.endsWith("ier")) add(word.slice(0, -3) + "y");
  if (word.endsWith("iest")) add(word.slice(0, -4) + "y");
  if (word.endsWith("est")) add(word.slice(0, -3));
  if (word.endsWith("er")) add(word.slice(0, -2));
  if (word.endsWith("ly")) add(word.slice(0, -2));
  return [...forms];
}

export async function lookupWord(value, loadChunk) {
  for (const form of wordForms(value)) {
    if (!/^[a-z]/.test(form)) continue;
    const chunk = await loadChunk(form[0]);
    const senses = chunk?.[form];
    if (Array.isArray(senses) && senses.length)
      return { word: form, senses, matchedForm: form };
  }
  return null;
}

// A paragraph selection can be long; look up its distinct words in order.
export function phraseWords(value, limit = 6) {
  const seen = new Set();
  const words = [];
  for (const match of String(value ?? "").matchAll(/[\p{L}\p{N}][\p{L}\p{N}_’'-]*/gu)) {
    const word = normalizeWord(match[0]);
    if (word.length < 2 || seen.has(word)) continue;
    seen.add(word);
    words.push(word);
    if (words.length >= limit) break;
  }
  return words;
}
