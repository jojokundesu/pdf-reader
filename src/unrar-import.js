import { createExtractorFromData } from "node-unrar-js/esm/index.esm.js";
import wasmUrl from "node-unrar-js/esm/js/unrar.wasm?url";

const IMAGE = /\.(?:avif|bmp|gif|jpe?g|png|webp)$/i;
export async function readRarImages(data) {
  const wasmBinary = await fetch(wasmUrl).then((response) => {
    if (!response.ok)
      throw Error("The offline comic archive engine could not be loaded.");
    return response.arrayBuffer();
  });
  const extractor = await createExtractorFromData({ data, wasmBinary });
  const listing = extractor.getFileList();
  const headers = [...listing.fileHeaders];
  if (headers.length > 5000)
    throw Error("This comic archive contains too many files.");
  const images = headers.filter(
    (header) => !header.flags.directory && IMAGE.test(header.name),
  );
  if (!images.length)
    throw Error("This RAR archive contains no supported comic page images.");
  if (images.length > 1000)
    throw Error("This comic has more than 1,000 image pages.");
  if (
    images.reduce((sum, header) => sum + header.unpSize, 0) >
    500 * 1024 * 1024
  )
    throw Error("This archive expands beyond the safe 500 MB import limit.");
  const selected = new Set(images.map((header) => header.name));
  const result = extractor.extract({
    files: (header) => selected.has(header.name),
  });
  const files = [...result.files]
    .filter((entry) => entry.extraction)
    .map((entry) => ({
      name: entry.fileHeader.name,
      bytes: entry.extraction,
    }));
  files.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
  return files;
}
