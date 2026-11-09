import { assertCanvasExportAllowed, convertImage } from "./image";
import {
  detectSourceFormat,
  MAX_OUTPUT_BYTES,
  MAX_OUTPUT_FILES,
  type OutputFormat,
  outputName,
  uniqueName,
  validateFiles,
} from "./logic";

export interface ConversionOptions {
  format: OutputFormat;
  quality: number;
  pdfScale: number;
  pageRange: string;
  pdfPassword: string;
}
export interface ConvertedFile {
  name: string;
  blob: Blob;
  source: string;
  width?: number;
  height?: number;
  page?: number;
  pages?: number;
}
export interface ConversionFailure {
  name: string;
  message: string;
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "PasswordException")
      return "This PDF needs a password, or the password is incorrect. Enter it in PDF options and try again.";
    if (error.name === "InvalidPDFException") return "This PDF is damaged or could not be read.";
    if (error.name === "InvalidStateError" || error.name === "EncodingError")
      return "This image is damaged or its format is not supported by this browser.";
    return error.message;
  }
  return "This file could not be converted.";
}

export async function convertFiles(
  files: File[],
  options: ConversionOptions,
  signal: AbortSignal,
  callbacks: { progress: (message: string) => void; output: (file: ConvertedFile) => void },
) {
  validateFiles(files);
  if (!files.length) throw new Error("Choose files to convert first.");
  if (!Number.isFinite(options.quality) || options.quality < 0.01 || options.quality > 1)
    throw new Error("Choose an image quality between 1 and 100 percent.");
  if (![1, 2, 3].includes(options.pdfScale)) throw new Error("Choose a supported PDF resolution.");
  signal.throwIfAborted();
  assertCanvasExportAllowed();
  const errors: ConversionFailure[] = [];
  const usedNames = new Set<string>();
  let outputBytes = 0;
  let outputCount = 0;
  const emit = (file: ConvertedFile) => {
    signal.throwIfAborted();
    if (outputCount >= MAX_OUTPUT_FILES)
      throw new Error("A conversion can produce at most 100 files. Choose fewer PDF pages.");
    if (outputBytes + file.blob.size > MAX_OUTPUT_BYTES)
      throw new Error(
        "The conversion reached its 100 MiB output limit. Choose fewer files or PDF pages.",
      );
    outputBytes += file.blob.size;
    outputCount++;
    callbacks.output({ ...file, name: uniqueName(file.name, usedNames) });
  };
  if (options.format === "pdf") {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    let encodedBytes = 0;
    for (const [index, file] of files.entries()) {
      signal.throwIfAborted();
      callbacks.progress(`Adding image ${index + 1} of ${files.length} · ${file.name}`);
      const source = detectSourceFormat(new Uint8Array(await file.slice(0, 1024).arrayBuffer()));
      if (!source || source === "pdf")
        throw new Error(
          "PDF output combines image files. Choose images only, or select PNG, JPG, or WebP to export PDF pages.",
        );
      const image = await convertImage(
        file,
        source === "jpeg" ? "jpeg" : "png",
        options.quality,
        signal,
      );
      encodedBytes += image.blob.size;
      if (encodedBytes > MAX_OUTPUT_BYTES)
        throw new Error("These images are too large to combine. Choose fewer or smaller images.");
      const bytes = await image.blob.arrayBuffer();
      const embedded = source === "jpeg" ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
      const page = pdf.addPage([image.width, image.height]);
      page.drawImage(embedded, { x: 0, y: 0, width: image.width, height: image.height });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    signal.throwIfAborted();
    callbacks.progress("Finishing your PDF…");
    const bytes = await pdf.save();
    emit({
      name: files.length === 1 ? outputName(files[0].name, "pdf") : "converted-images.pdf",
      blob: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
      source: `${files.length} image${files.length === 1 ? "" : "s"}`,
      pages: files.length,
    });
    return { errors, outputCount };
  }
  for (const [index, file] of files.entries()) {
    signal.throwIfAborted();
    callbacks.progress(`Converting file ${index + 1} of ${files.length} · ${file.name}`);
    try {
      const source = detectSourceFormat(new Uint8Array(await file.slice(0, 1024).arrayBuffer()));
      if (!source)
        throw new Error(
          "Unsupported or damaged file. Choose JPG, PNG, WebP, GIF, BMP, AVIF, or PDF.",
        );
      if (outputCount >= MAX_OUTPUT_FILES || outputBytes >= MAX_OUTPUT_BYTES)
        throw new Error("Output limit reached. Choose fewer files or PDF pages.");
      if (source === "pdf") {
        const { renderPdf } = await import("./pdf");
        await renderPdf(
          file,
          {
            format: options.format,
            quality: options.quality,
            scale: options.pdfScale,
            pageRange: options.pageRange,
            password: options.pdfPassword,
            remaining: MAX_OUTPUT_FILES - outputCount,
          },
          signal,
          callbacks.progress,
          (result) =>
            emit({
              ...result,
              name: outputName(file.name, options.format, result.page),
              source: file.name,
            }),
        );
      } else {
        const result = await convertImage(file, options.format, options.quality, signal);
        emit({ ...result, name: outputName(file.name, options.format), source: file.name });
      }
    } catch (error) {
      signal.throwIfAborted();
      errors.push({ name: file.name, message: describeError(error) });
    }
  }
  return { errors, outputCount };
}

export async function zipResults(files: ConvertedFile[], signal: AbortSignal): Promise<Blob> {
  const { zip } = await import("fflate");
  const entries: Record<string, Uint8Array> = Object.create(null);
  for (const file of files) {
    signal.throwIfAborted();
    entries[file.name] = new Uint8Array(await file.blob.arrayBuffer());
  }
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    let terminate: (() => void) | undefined;
    const abort = () => {
      terminate?.();
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    terminate = zip(entries, { level: 0 }, (error, data) => {
      signal.removeEventListener("abort", abort);
      if (signal.aborted) reject(signal.reason);
      else if (error) reject(error);
      else resolve(new Blob([new Uint8Array(data)], { type: "application/zip" }));
    });
  });
}
