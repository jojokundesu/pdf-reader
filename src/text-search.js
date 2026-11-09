export function canonicalPageText(items = []) {
  return items
    .filter((item) => typeof item?.str === "string")
    .map((item) => item.str)
    .join(" ");
}

function normalizedTextWithOffsets(value) {
  const source = String(value ?? "");
  let text = "";
  const starts = [];
  const ends = [];

  for (let offset = 0; offset < source.length;) {
    const codePoint = source.codePointAt(offset);
    const original = String.fromCodePoint(codePoint);
    const end = offset + original.length;
    const folded = original.normalize("NFKC").toLocaleLowerCase();

    for (const character of folded) {
      if (/\s/u.test(character)) {
        if (text && text.at(-1) !== " ") {
          text += " ";
          starts.push(offset);
          ends.push(end);
        } else if (text) {
          ends[ends.length - 1] = end;
        }
        continue;
      }

      for (let i = 0; i < character.length; i++) {
        text += character[i];
        starts.push(offset);
        ends.push(end);
      }
    }

    offset = end;
  }

  if (text.endsWith(" ")) {
    text = text.slice(0, -1);
    starts.pop();
    ends.pop();
  }
  return { text, starts, ends };
}

export function normalizeSearchText(value) {
  return normalizedTextWithOffsets(value).text;
}

export function findTextMatches(text, query) {
  const haystack = normalizedTextWithOffsets(text);
  const needle = normalizeSearchText(query);
  if (!needle) return [];

  const matches = [];
  let cursor = 0;
  while (cursor <= haystack.text.length - needle.length) {
    const index = haystack.text.indexOf(needle, cursor);
    if (index < 0) break;
    matches.push({
      start: haystack.starts[index],
      end: haystack.ends[index + needle.length - 1],
    });
    cursor = index + Math.max(needle.length, 1);
  }
  return matches;
}

export function textItemOffsets(items = []) {
  let offset = 0;
  return items
    .filter((item) => typeof item?.str === "string")
    .map((item) => {
      const range = { start: offset, end: offset + item.str.length };
      offset = range.end + 1;
      return range;
    });
}

export function rangesForTextMatches(container, query) {
  if (!container || !query) return [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeValue) nodes.push(node);
  }
  if (!nodes.length) return [];

  const starts = [];
  const ends = [];
  let text = "";
  nodes.forEach((textNode, index) => {
    if (index) text += " ";
    starts.push(text.length);
    text += textNode.nodeValue;
    ends.push(text.length);
  });

  return findTextMatches(text, query).flatMap((match) => {
    const firstIndex = ends.findIndex((end) => end > match.start);
    const lastIndex = ends.findIndex((end) => end >= match.end);
    if (firstIndex < 0 || lastIndex < firstIndex) return [];

    const range = document.createRange();
    range.setStart(
      nodes[firstIndex],
      Math.max(0, match.start - starts[firstIndex]),
    );
    range.setEnd(
      nodes[lastIndex],
      Math.min(
        nodes[lastIndex].nodeValue.length,
        match.end - starts[lastIndex],
      ),
    );
    return [{ ...match, range }];
  });
}
