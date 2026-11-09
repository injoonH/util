import { cp, mkdir, rm, stat } from "node:fs/promises";

// PDF.js fetches these fonts, character maps, and codecs on demand. Keep them
// on our origin so converting a local document never needs a third-party CDN.
const source = new URL("../node_modules/pdfjs-dist/", import.meta.url);
const destination = new URL("../public/pdfjs/", import.meta.url);
const folders = ["cmaps", "standard_fonts", "wasm"];
for (const folder of folders) await stat(new URL(folder, source));
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const folder of folders) {
  await cp(new URL(folder, source), new URL(folder, destination), { recursive: true });
}
await cp(new URL("LICENSE", source), new URL("LICENSE", destination));
