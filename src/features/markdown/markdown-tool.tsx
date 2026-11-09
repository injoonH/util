import { Download, RotateCcw, Upload } from "lucide-react";
import { useDeferredValue, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolPanel } from "@/components/tools/tool-panel";
import { ToolSplit } from "@/components/tools/tool-split";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownPreview } from "./markdown-preview";
import "./markdown.css";

const starter = `# Make something useful.

A little space to turn **plain text** into something clear.

## Your next idea

- [x] Open the Markdown preview
- [ ] Write something worth sharing
- [ ] Download your document

> The best tools get out of your way.

### A small example

\`\`\`typescript
const greeting = "Hello, world!";
console.log(greeting);
\`\`\`

| Shortcut | What it does |
| --- | --- |
| **Bold** | Add emphasis |
| \`code\` | Keep it precise |
| [A link](https://commonmark.org/help/) | Keep exploring |
`;

export default function MarkdownTool() {
  const id = useId();
  const [input, setInput] = useState(starter);
  const [allowImages, setAllowImages] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = useDeferredValue(input);
  const isUpdating = preview !== input;

  async function importFile(file: File | undefined) {
    if (!file) return;
    setFileError("");
    if (file.size > 1024 * 1024) {
      setFileError("Choose a Markdown file smaller than 1 MiB for a responsive preview.");
      return;
    }
    try {
      const content = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      setInput(content);
      toast.success(`Opened ${file.name}`);
    } catch {
      setFileError("This file could not be read as UTF-8 text. Try a Markdown or plain text file.");
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([input], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "document.md";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="tool-stack">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <Upload className="size-4" /> Open file
          </Button>
          <Button variant="outline" onClick={download} disabled={!input}>
            <Download className="size-4" /> Download .md
          </Button>
          <Input
            ref={fileInput}
            type="file"
            className="hidden"
            aria-label="Open Markdown file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            onChange={(event) => {
              void importFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id={`${id}-images`} checked={allowImages} onCheckedChange={setAllowImages} />
          <Label htmlFor={`${id}-images`} className="text-sm text-muted-foreground">
            Load images
          </Label>
        </div>
      </div>
      {fileError && (
        <Alert variant="destructive">
          <AlertDescription>{fileError}</AlertDescription>
        </Alert>
      )}
      <ToolSplit resizeLabel="Resize Markdown source and preview panels">
        <ToolPanel
          title="Markdown source"
          actions={
            <div className="flex items-center gap-1">
              <CopyButton value={input} disabled={!input} />
              <Button
                variant="ghost"
                size="sm"
                aria-label="Clear Markdown"
                disabled={!input}
                onClick={() => setInput("")}
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </div>
          }
          footer={`${input ? input.split(/\r\n|\r|\n/).length : 0} lines · ${Array.from(input).length.toLocaleString()} characters`}
        >
          <Textarea
            className="tool-editor min-h-[500px]"
            aria-label="Markdown source"
            placeholder="# Start writing here…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </ToolPanel>
        <ToolPanel
          title="Live preview"
          actions={
            <span className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
              <span
                className={`size-1.5 rounded-full ${isUpdating ? "bg-amber-500" : "bg-emerald-500"}`}
              />
              {isUpdating ? "Updating" : "Live"}
            </span>
          }
          footer="GitHub-flavored Markdown · HTML is ignored"
        >
          <section
            className="markdown-preview min-h-[500px] overflow-x-auto p-5 sm:p-6"
            aria-label="Markdown preview"
            aria-busy={isUpdating}
          >
            {preview ? (
              <MarkdownPreview value={preview} allowImages={allowImages} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Your document takes shape here as you type.
              </p>
            )}
          </section>
        </ToolPanel>
      </ToolSplit>
      <p className="text-sm text-muted-foreground">
        {allowImages
          ? "Images may load from external websites. Your Markdown text is processed in this browser."
          : "Images stay unloaded until you enable them. Your Markdown text stays in this browser."}
      </p>
    </div>
  );
}
