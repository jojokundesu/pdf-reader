// Builds the offline English dictionary that backs the "Meaning" action.
//
// WordNet (Princeton) is converted at build time into one JSON chunk per first
// letter so the reader only loads the slice it needs. Nothing is fetched at
// runtime: the dictionary ships inside the web build and the APK.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dbDir = "node_modules/wordnet/db";
const outDir = "public/dictionary";
const posName = { n: "noun", v: "verb", a: "adjective", s: "adjective", r: "adverb" };

function parseData(file) {
  const synsets = new Map();
  for (const line of readFileSync(join(dbDir, file), "utf8").split("\n")) {
    if (!line || line.startsWith("  ")) continue;
    const bar = line.indexOf("|");
    if (bar < 0) continue;
    const head = line.slice(0, bar).trim().split(" ");
    const gloss = line.slice(bar + 1).trim();
    const offset = head[0];
    const wordCount = Number(head[3]);
    if (!Number.isFinite(wordCount)) continue;
    const words = [];
    for (let i = 0; i < wordCount; i++) {
      const word = head[4 + i * 2];
      if (word) words.push(word.replace(/_/g, " "));
    }
    const examples = [];
    const definition = gloss
      .replace(/"([^"]*)"/g, (_, example) => {
        examples.push(example.trim());
        return "";
      })
      .replace(/\s+/g, " ")
      .replace(/\s*;\s*(;\s*)+/g, "; ")
      .replace(/[\s;]+$/, "")
      .trim();
    synsets.set(offset, { definition, examples, words });
  }
  return synsets;
}

function parseIndex(file, synsets, dictionary) {
  for (const line of readFileSync(join(dbDir, file), "utf8").split("\n")) {
    if (!line || line.startsWith("  ")) continue;
    const fields = line.trim().split(" ");
    const lemma = fields[0]?.replace(/_/g, " ");
    const pos = fields[1];
    const pointerCount = Number(fields[3]);
    if (!lemma || !pos || !Number.isFinite(pointerCount)) continue;
    const offsets = fields.slice(6 + pointerCount);
    for (const offset of offsets) {
      const synset = synsets.get(offset);
      if (!synset?.definition) continue;
      const entry = dictionary.get(lemma) || [];
      if (entry.length >= 6) break;
      entry.push({
        p: posName[pos] || "word",
        d: synset.definition,
        s: synset.words.filter((word) => word.toLowerCase() !== lemma.toLowerCase()).slice(0, 6),
        e: synset.examples.slice(0, 2),
      });
      dictionary.set(lemma, entry);
    }
  }
}

const dictionary = new Map();
for (const [index, data] of [
  ["index.noun", "data.noun"],
  ["index.verb", "data.verb"],
  ["index.adj", "data.adj"],
  ["index.adv", "data.adv"],
]) {
  const synsets = parseData(data);
  parseIndex(index, synsets, dictionary);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const chunks = new Map();
for (const [word, senses] of dictionary) {
  const key = /^[a-z]/i.test(word) ? word[0].toLowerCase() : "_";
  if (!chunks.has(key)) chunks.set(key, {});
  chunks.get(key)[word.toLowerCase()] = senses.map((sense) => {
    const entry = { p: sense.p, d: sense.d };
    if (sense.s.length) entry.s = sense.s;
    if (sense.e.length) entry.e = sense.e;
    return entry;
  });
}

let total = 0;
for (const [key, words] of [...chunks].sort()) {
  const json = JSON.stringify(words);
  writeFileSync(join(outDir, `${key}.json`), json);
}
for (const file of readdirSync(outDir))
  total += readFileSync(join(outDir, file)).length;
console.log(
  `dictionary: ${dictionary.size} words, ${chunks.size} chunks, ${(total / 1024 / 1024).toFixed(1)} MB of JSON`,
);
