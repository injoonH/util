export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_INPUT_BYTES = 50 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 100 * 1024 * 1024;
export const MAX_OUTPUT_FILES = 100;
export const MAX_PIXELS = 16_000_000;
export const MAX_DIMENSION = 8192;

export const OUTPUT_FORMATS = [
  { id: "png", label: "PNG", mime: "image/png", extension: "png" },
  { id: "jpeg", label: "JPG", mime: "image/jpeg", extension: "jpg" },
  { id: "webp", label: "WebP", mime: "image/webp", extension: "webp" },
  { id: "pdf", label: "PDF", mime: "application/pdf", extension: "pdf" },
] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number]["id"];
export type ImageOutputFormat = Exclude<OutputFormat, "pdf">;
export type SourceFormat = "jpeg" | "png" | "webp" | "gif" | "bmp" | "avif" | "pdf";

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function validateFiles(files: ReadonlyArray<{ name: string; size: number }>) {
  if (files.length > MAX_FILES) throw new Error(`Choose up to ${MAX_FILES} files at a time.`);
  let total = 0;
  for (const file of files) {
    if (!file.size) throw new Error(`${file.name} is empty. Choose a file with content.`);
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} exceeds the 25 MiB file limit.`);
    total += file.size;
  }
  if (total > MAX_INPUT_BYTES) throw new Error("Choose files totaling 50 MiB or less.");
}

/** Inspect content signatures, rather than trusting the filename or MIME label. */
export function detectSourceFormat(bytes: Uint8Array): SourceFormat | null {
  if (
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)
  )
    return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (["GIF87a", "GIF89a"].includes(ascii(0, 6))) return "gif";
  if (ascii(0, 2) === "BM") return "bmp";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(4, 8) === "ftyp" && /avif|avis/.test(ascii(8, 64))) return "avif";
  if (ascii(0, 1024).includes("%PDF-")) return "pdf";
  return null;
}

export function parsePageRange(
  value: string,
  pageCount: number,
  limit = MAX_OUTPUT_FILES,
): number[] {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1)
    throw new Error("The PDF has no readable pages.");
  const text = value.trim();
  if (!text || text.toLowerCase() === "all") {
    if (pageCount > limit) throw new Error(`Choose a page range with at most ${limit} pages.`);
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const pages = new Set<number>();
  for (const part of text.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Use page numbers like 1, 3-5. Leave blank for all pages.");
    const first = Number(match[1]);
    const last = match[2] ? Number(match[2]) : first;
    if (
      !Number.isSafeInteger(first) ||
      !Number.isSafeInteger(last) ||
      first < 1 ||
      last > pageCount ||
      first > last
    )
      throw new Error(`Choose page numbers between 1 and ${pageCount}, in ascending ranges.`);
    if (last - first + 1 > limit) throw new Error(`Choose at most ${limit} pages per conversion.`);
    for (let page = first; page <= last; page++) {
      pages.add(page);
      if (pages.size > limit) throw new Error(`Choose at most ${limit} pages per conversion.`);
    }
  }
  return [...pages];
}

export function validateDimensions(width: number, height: number) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1)
    throw new Error("The file has invalid image dimensions.");
  if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS)
    throw new Error(
      "The image is too large to convert safely in this browser. Use an image below 16 megapixels and 8,192 pixels per side, or lower the PDF resolution.",
    );
}

export function outputName(name: string, format: OutputFormat, page?: number) {
  let stem =
    name
      .replace(/\.[^.]*$/, "")
      .replace(/\p{Cc}/gu, "-")
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/^[.\s]+|[.\s]+$/g, "")
      .slice(0, 120) || "converted";
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(stem)) stem = `file-${stem}`;
  const extension = OUTPUT_FORMATS.find((item) => item.id === format)?.extension;
  return `${stem}${page === undefined ? "" : `-page-${String(page).padStart(3, "0")}`}.${extension}`;
}

export function uniqueName(name: string, used: Set<string>) {
  let candidate = name;
  let counter = 2;
  const dot = name.lastIndexOf(".");
  while (used.has(candidate.toLowerCase()))
    candidate = `${name.slice(0, dot)} (${counter++})${name.slice(dot)}`;
  used.add(candidate.toLowerCase());
  return candidate;
}
