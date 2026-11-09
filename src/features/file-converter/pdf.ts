import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { canvasBlob } from "./image";
import { type ImageOutputFormat, MAX_PIXELS, parsePageRange, validateDimensions } from "./logic";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function renderPdf(
  file: File,
  options: {
    format: ImageOutputFormat;
    quality: number;
    scale: number;
    pageRange: string;
    password: string;
    remaining: number;
  },
  signal: AbortSignal,
  progress: (message: string) => void,
  output: (result: { blob: Blob; width: number; height: number; page: number }) => void,
) {
  signal.throwIfAborted();
  const loading = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    password: options.password || undefined,
    cMapUrl: `${window.location.origin}/pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${window.location.origin}/pdfjs/standard_fonts/`,
    wasmUrl: `${window.location.origin}/pdfjs/wasm/`,
    enableXfa: false,
    useSystemFonts: false,
    canvasMaxAreaInBytes: MAX_PIXELS * 4,
    verbosity: 0,
  });
  const abortLoading = () => {
    void loading.destroy().catch(() => undefined);
  };
  signal.addEventListener("abort", abortLoading, { once: true });
  try {
    const document = await loading.promise;
    signal.throwIfAborted();
    const pages = parsePageRange(options.pageRange, document.numPages, options.remaining);
    for (const number of pages) {
      signal.throwIfAborted();
      progress(`Rendering ${file.name} · page ${number} of ${document.numPages}`);
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale: options.scale });
      const canvas = window.document.createElement("canvas");
      try {
        const width = Math.ceil(viewport.width);
        const height = Math.ceil(viewport.height);
        validateDimensions(width, height);
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Your browser cannot render a PDF page.");
        const render = page.render({
          canvas,
          canvasContext: context,
          viewport,
          background: "#ffffff",
        });
        const abortRender = () => render.cancel();
        signal.addEventListener("abort", abortRender, { once: true });
        try {
          await render.promise;
        } finally {
          signal.removeEventListener("abort", abortRender);
        }
        signal.throwIfAborted();
        output({
          blob: await canvasBlob(canvas, options.format, options.quality, signal),
          width: canvas.width,
          height: canvas.height,
          page: number,
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      } finally {
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }
    }
  } finally {
    signal.removeEventListener("abort", abortLoading);
    await loading.destroy();
  }
}
