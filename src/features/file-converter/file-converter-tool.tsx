import {
  ArrowRightLeft,
  Check,
  Download,
  FileImage,
  Files,
  FileText,
  FolderArchive,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ToolPanel } from "@/components/tools/tool-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ConversionFailure, type ConvertedFile, convertFiles, zipResults } from "./convert";
import { formatBytes, OUTPUT_FORMATS, type OutputFormat, validateFiles } from "./logic";

interface PreviewFile extends ConvertedFile {
  id: string;
  url: string;
}
function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}
function download(url: string, name: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
}

export default function FileConverterTool() {
  const [files, setFiles] = useState<{ id: string; file: File }[]>([]);
  const [format, setFormat] = useState<OutputFormat>("png");
  const [quality, setQuality] = useState("90");
  const [pdfScale, setPdfScale] = useState("2");
  const [pageRange, setPageRange] = useState("");
  const [pdfPassword, setPdfPassword] = useState("");
  const [outputs, setOutputs] = useState<PreviewFile[]>([]);
  const [errors, setErrors] = useState<(ConversionFailure & { id: string })[]>([]);
  const [selectionError, setSelectionError] = useState("");
  const [phase, setPhase] = useState<"idle" | "converting" | "zip">("idle");
  const [status, setStatus] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const outputRef = useRef<PreviewFile[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const busy = phase !== "idle";
  const hasPdf = files.some(({ file }) => isPdf(file));
  const invalidPdfOutput = format === "pdf" && hasPdf;
  const usesQuality = format === "jpeg" || format === "webp";
  const qualityNumber = Number(quality);
  const invalidQuality =
    usesQuality && (!Number.isInteger(qualityNumber) || qualityNumber < 1 || qualityNumber > 100);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controllerRef.current?.abort();
      for (const output of outputRef.current) URL.revokeObjectURL(output.url);
      outputRef.current = [];
    };
  }, []);

  function clearOutputs() {
    for (const output of outputRef.current) URL.revokeObjectURL(output.url);
    outputRef.current = [];
    setOutputs([]);
    setErrors([]);
    setStatus("");
  }

  function addFiles(incoming: FileList | File[]) {
    if (busy) return;
    const additions = Array.from(incoming);
    if (!additions.length) return;
    const combined = [...files, ...additions.map((file) => ({ file, id: crypto.randomUUID() }))];
    try {
      validateFiles(combined.map(({ file }) => file));
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : "These files could not be added.");
      return;
    }
    clearOutputs();
    setSelectionError("");
    setFiles(combined);
    setPdfPassword("");
  }

  function onFileInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  }

  async function convert() {
    if (busy || !files.length || invalidQuality || invalidPdfOutput) return;
    clearOutputs();
    setSelectionError("");
    setPhase("converting");
    setStatus("Getting your files ready…");
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await convertFiles(
        files.map(({ file }) => file),
        {
          format,
          quality: usesQuality ? qualityNumber / 100 : 0.9,
          pdfScale: Number(pdfScale),
          pageRange,
          pdfPassword,
        },
        controller.signal,
        {
          progress: (message) => {
            if (mounted.current && !controller.signal.aborted) setStatus(message);
          },
          output: (output) => {
            if (!mounted.current || controller.signal.aborted) return;
            const preview = {
              ...output,
              id: crypto.randomUUID(),
              url: URL.createObjectURL(output.blob),
            };
            outputRef.current = [...outputRef.current, preview];
            setOutputs(outputRef.current);
          },
        },
      );
      if (!mounted.current) return;
      setErrors(result.errors.map((error) => ({ ...error, id: crypto.randomUUID() })));
      setStatus(
        result.outputCount
          ? `${result.outputCount} file${result.outputCount === 1 ? "" : "s"} ready${result.errors.length ? ` · ${result.errors.length} source file${result.errors.length === 1 ? "" : "s"} could not be converted` : " to download"}.`
          : "No files converted. Check the messages below.",
      );
      if (result.outputCount) {
        setPdfPassword("");
        toast.success("Your converted files are ready.");
      }
    } catch (error) {
      if (!mounted.current) return;
      if (controller.signal.aborted)
        setStatus(
          `Conversion stopped. ${outputRef.current.length} completed file${outputRef.current.length === 1 ? "" : "s"} available.`,
        );
      else {
        setErrors([
          {
            id: crypto.randomUUID(),
            name: "Conversion",
            message:
              error instanceof Error ? error.message : "The conversion failed. Please try again.",
          },
        ]);
        setStatus("");
      }
    } finally {
      if (mounted.current) setPhase("idle");
    }
  }

  async function downloadAll() {
    if (busy || !outputRef.current.length) return;
    if (outputRef.current.length === 1) {
      const output = outputRef.current[0];
      download(output.url, output.name);
      return;
    }
    setPhase("zip");
    setStatus("Preparing your ZIP download…");
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const blob = await zipResults(outputRef.current, controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      download(url, "converted-files.zip");
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`${outputRef.current.length} files downloaded as a ZIP.`);
    } catch (error) {
      if (!mounted.current) return;
      setStatus(
        controller.signal.aborted
          ? "ZIP download cancelled. Your converted files are still available."
          : "",
      );
      if (!controller.signal.aborted)
        toast.error(error instanceof Error ? error.message : "The ZIP could not be created.");
    } finally {
      if (mounted.current) setPhase("idle");
    }
  }

  return (
    <div className="tool-stack">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="gap-1.5">
          <LockKeyhole className="size-3" />
          Files stay on your device
        </Badge>
        <Badge variant="outline">Images ↔ PDF</Badge>
        <Badge variant="outline">Batch conversion</Badge>
      </div>
      <div className="tool-grid">
        <div className="tool-stack">
          <ToolPanel
            title="Your source files"
            description="Add images or PDFs to convert."
            actions={
              files.length ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Clear files"
                  disabled={busy}
                  onClick={() => {
                    setFiles([]);
                    setPdfPassword("");
                    setSelectionError("");
                    clearOutputs();
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Clear
                </Button>
              ) : undefined
            }
          >
            <Input
              ref={fileInput}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.pdf"
              className="hidden"
              aria-label="Choose files"
              onChange={onFileInput}
              disabled={busy}
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                addFiles(event.dataTransfer.files);
              }}
              className={`h-auto w-full flex-col gap-3 whitespace-normal rounded-xl border-dashed px-5 py-8 text-center shadow-none ${dragging ? "border-primary bg-accent" : "bg-muted/20"}`}
              aria-label="Choose images or PDF files"
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
                <Upload className="size-5" />
              </span>
              <span className="font-medium">Drop files here, or browse</span>
              <span className="text-xs font-normal leading-6 text-muted-foreground">
                JPG, PNG, WebP, GIF, BMP, AVIF, PDF
                <br />
                Up to 10 files · 25 MiB each · 50 MiB total
              </span>
            </Button>
            {selectionError && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{selectionError}</AlertDescription>
              </Alert>
            )}
            {files.length > 0 && (
              <ul aria-label="Selected files" className="mt-4 divide-y">
                {files.map(({ file, id }) => (
                  <li key={id} className="flex min-w-0 items-center gap-3 py-3">
                    {isPdf(file) ? (
                      <FileText className="size-5 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileImage className="size-5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="break-all text-sm font-medium">{file.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatBytes(file.size)} · {isPdf(file) ? "PDF document" : "Image"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      disabled={busy}
                      aria-label={`Remove ${file.name}`}
                      onClick={() => {
                        clearOutputs();
                        setFiles((current) => current.filter((item) => item.id !== id));
                        setSelectionError("");
                      }}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ToolPanel>
          <ToolPanel
            title="Conversion options"
            description="Choose the output format and settings."
          >
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="field-group">
                  <Label htmlFor="converter-format">Convert to</Label>
                  <Select
                    value={format}
                    onValueChange={(value) => {
                      if (OUTPUT_FORMATS.some((item) => item.id === value)) {
                        setFormat(value as OutputFormat);
                        clearOutputs();
                      }
                    }}
                    disabled={busy}
                  >
                    <SelectTrigger id="converter-format" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OUTPUT_FORMATS.map((item) => (
                        <SelectItem
                          key={item.id}
                          value={item.id}
                          disabled={item.id === "pdf" && hasPdf}
                        >
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(format === "jpeg" || format === "webp") && (
                  <div className="field-group">
                    <Label htmlFor="converter-quality">Quality (%)</Label>
                    <Input
                      id="converter-quality"
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={quality}
                      disabled={busy}
                      onChange={(event) => {
                        setQuality(event.target.value);
                        clearOutputs();
                      }}
                    />
                  </div>
                )}
              </div>
              {format === "jpeg" && (
                <p className="text-xs leading-6 text-muted-foreground">
                  Transparent areas become white when converting to JPG.
                </p>
              )}
              {format === "png" && (
                <p className="text-xs leading-6 text-muted-foreground">
                  PNG preserves image transparency and uses lossless encoding.
                </p>
              )}
              {format === "pdf" && (
                <p className="text-xs leading-6 text-muted-foreground">
                  Images become one PDF, with one image per page in the order listed.
                </p>
              )}
              {invalidPdfOutput && (
                <Alert variant="destructive">
                  <AlertDescription>
                    PDF output accepts images only. Remove the PDF source or choose PNG, JPG, or
                    WebP.
                  </AlertDescription>
                </Alert>
              )}
              {hasPdf && format !== "pdf" && (
                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  <p className="text-xs font-medium">PDF options</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="field-group">
                      <Label htmlFor="converter-pages">Pages</Label>
                      <Input
                        id="converter-pages"
                        placeholder="All pages, or 1, 3-5"
                        value={pageRange}
                        disabled={busy}
                        onChange={(event) => {
                          setPageRange(event.target.value);
                          clearOutputs();
                        }}
                      />
                    </div>
                    <div className="field-group">
                      <Label htmlFor="converter-resolution">Resolution</Label>
                      <Select
                        value={pdfScale}
                        onValueChange={(value) => {
                          setPdfScale(value);
                          clearOutputs();
                        }}
                        disabled={busy}
                      >
                        <SelectTrigger id="converter-resolution" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">72 DPI · Standard</SelectItem>
                          <SelectItem value="2">144 DPI · Sharp</SelectItem>
                          <SelectItem value="3">216 DPI · High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="field-group">
                    <Label htmlFor="converter-password">PDF password (if needed)</Label>
                    <Input
                      id="converter-password"
                      type="password"
                      autoComplete="off"
                      value={pdfPassword}
                      disabled={busy}
                      onChange={(event) => {
                        setPdfPassword(event.target.value);
                        clearOutputs();
                      }}
                    />
                  </div>
                  <p className="text-xs leading-6 text-muted-foreground">
                    Options apply to each PDF. Export up to 100 pages per conversion.
                  </p>
                </div>
              )}
              {invalidQuality && (
                <p role="alert" className="text-xs text-destructive">
                  Enter a quality between 1 and 100.
                </p>
              )}
              <Button
                onClick={() => void convert()}
                disabled={busy || !files.length || invalidQuality || invalidPdfOutput}
                className="w-full"
              >
                {phase === "converting" ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <ArrowRightLeft />
                )}
                {phase === "converting" ? "Converting…" : "Convert files"}
              </Button>
              <p className="text-xs leading-6 text-muted-foreground">
                Images keep their dimensions. Animated inputs export a still image. Some formats
                depend on your browser’s decoding support.
              </p>
            </div>
          </ToolPanel>
        </div>
        <ToolPanel
          title="Converted files"
          className="self-start"
          description={
            outputs.length
              ? `${outputs.length} converted file${outputs.length === 1 ? "" : "s"} · ${formatBytes(outputs.reduce((sum, item) => sum + item.blob.size, 0))}`
              : "Your converted files will appear here."
          }
          actions={
            outputs.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void downloadAll()}
              >
                {outputs.length > 1 ? <FolderArchive /> : <Download />}
                {outputs.length > 1 ? "Download ZIP" : "Download file"}
              </Button>
            ) : undefined
          }
        >
          {(status || busy) && (
            <div className="mb-4 flex items-start justify-between gap-2 rounded-lg bg-muted/70 p-3">
              <p
                role="status"
                className="flex min-w-0 items-start gap-2 text-xs leading-6 text-muted-foreground"
              >
                {busy ? (
                  <LoaderCircle className="mt-1 size-3.5 shrink-0 animate-spin" />
                ) : (
                  <Check className="mt-1 size-3.5 shrink-0" />
                )}
                <span className="break-all">{status}</span>
              </p>
              {busy && (
                <Button variant="ghost" size="sm" onClick={() => controllerRef.current?.abort()}>
                  Cancel
                </Button>
              )}
            </div>
          )}
          {errors.length > 0 && (
            <div className="mb-4 space-y-2">
              {errors.map((error) => (
                <Alert variant="destructive" key={error.id}>
                  <AlertDescription>
                    <span className="font-medium break-all">{error.name}</span>
                    <span>{error.message}</span>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
          {outputs.length ? (
            <ul aria-label="Converted files" className="space-y-3">
              {outputs.map((output) => (
                <li
                  key={output.id}
                  className="flex min-w-0 items-center gap-3 rounded-xl border p-3"
                >
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                    {output.blob.type.startsWith("image/") ? (
                      <img
                        src={output.url}
                        alt={`Preview of ${output.name}`}
                        className="size-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <FileText className="size-7 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-all text-sm font-medium">{output.name}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {formatBytes(output.blob.size)} ·{" "}
                      {output.pages
                        ? `${output.pages} pages`
                        : `${output.width} × ${output.height} px`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => download(output.url, output.name)}
                    aria-label={`Download ${output.name}`}
                  >
                    <Download className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center px-5 py-8 text-center">
              <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-accent text-primary">
                <ImagePlus className="size-7" strokeWidth={1.4} />
              </div>
              <h3 className="font-medium">Choose a file to get started</h3>
              <p className="mt-2 max-w-64 text-sm leading-7 text-muted-foreground">
                Turn a photo into a PNG, export PDF pages as images, or gather images into a PDF.
              </p>
              <div className="mt-7 flex items-center gap-3 text-[10px] font-medium tracking-widest text-muted-foreground">
                <Files className="size-3.5" />
                <span>CHOOSE</span>
                <ArrowRightLeft className="size-3" />
                <span>CONVERT</span>
                <Download className="size-3.5" />
              </div>
            </div>
          )}
        </ToolPanel>
      </div>
      <div className="flex items-start gap-2.5 rounded-xl bg-muted/70 px-4 py-3.5 text-xs leading-6 text-muted-foreground">
        <LockKeyhole className="mt-1 size-3.5 shrink-0" />
        <p>
          Files are processed in your browser and are never uploaded. Clearing the tool or leaving
          this page removes its previews. Large images and PDFs may need a lower resolution or a
          smaller page range.
        </p>
      </div>
    </div>
  );
}
