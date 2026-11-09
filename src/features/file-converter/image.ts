import { type ImageOutputFormat, OUTPUT_FORMATS, validateDimensions } from "./logic";

const exportBlockedMessage =
  "Your browser is blocking accurate image export. In Firefox, allow “Extract Canvas Data” for this site, then try again. A canvas-blocking extension may also need a site exception.";

export function assertCanvasExportAllowed() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 1;
  try {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Your browser cannot create an image canvas.");
    for (const [index, color] of ["#ff0000", "#00ff00", "#0000ff", "#ffffff"].entries()) {
      context.fillStyle = color;
      context.fillRect(index, 0, 1, 1);
    }
    const expected = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255];
    let actual: Uint8ClampedArray;
    try {
      actual = context.getImageData(0, 0, 4, 1).data;
    } catch {
      throw new Error(exportBlockedMessage);
    }
    // A fixed color check catches blocked/randomized canvas access without
    // inspecting the user's file or treating a legitimately black image as bad.
    if (
      actual.length !== expected.length ||
      expected.some((channel, index) => Math.abs(actual[index] - channel) > 4)
    )
      throw new Error(exportBlockedMessage);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

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
  const url = URL.createObjectURL(file);
  const image = new Image();
  const close = () => {
    image.src = "";
    URL.revokeObjectURL(url);
  };
  const abort = () => {
    image.src = "";
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    image.src = url;
    await image.decode();
    signal.throwIfAborted();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close,
    };
  } catch (error) {
    close();
    signal.throwIfAborted();
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
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
    // File export needs reliable CPU readback rather than an accelerated
    // ImageBitmap/canvas path. Keep the decoded source alive until encoding ends.
    const context = canvas.getContext("2d", {
      alpha: format !== "jpeg",
      willReadFrequently: true,
    });
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
