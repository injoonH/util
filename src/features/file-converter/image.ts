import { type ImageOutputFormat, OUTPUT_FORMATS, validateDimensions } from "./logic";

export async function canvasBlob(
  canvas: HTMLCanvasElement,
  format: ImageOutputFormat,
  quality: number,
  signal: AbortSignal,
): Promise<Blob> {
  signal.throwIfAborted();
  const mime = OUTPUT_FORMATS.find((item) => item.id === format)?.mime;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
  signal.throwIfAborted();
  if (!blob) throw new Error("This browser could not encode the image. Try a smaller image.");
  if (blob.type !== mime)
    throw new Error(
      `This browser cannot export ${format.toUpperCase()}. Choose PNG or JPG instead.`,
    );
  return blob;
}

async function loadImage(file: File, signal: AbortSignal) {
  signal.throwIfAborted();
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    if (signal.aborted) {
      bitmap.close();
      signal.throwIfAborted();
    }
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => signal.removeEventListener("abort", abort);
      const abort = () => {
        cleanup();
        image.src = "";
        reject(signal.reason);
      };
      image.onload = () => {
        cleanup();
        resolve();
      };
      image.onerror = () => {
        cleanup();
        reject(new Error("This browser could not read the image."));
      };
      signal.addEventListener("abort", abort, { once: true });
      image.src = url;
    });
    signal.throwIfAborted();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => {
        image.src = "";
      },
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function convertImage(
  file: File,
  format: ImageOutputFormat,
  quality: number,
  signal: AbortSignal,
) {
  const image = await loadImage(file, signal);
  const canvas = document.createElement("canvas");
  try {
    validateDimensions(image.width, image.height);
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser cannot create an image canvas.");
    if (format === "jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image.source, 0, 0);
    return {
      blob: await canvasBlob(canvas, format, quality, signal),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    image.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
