import { Check, Download, RotateCcw, Sparkles } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolPanel } from "@/components/tools/tool-panel";
import { ToolSplit } from "@/components/tools/tool-split";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { type JsonIndent, type JsonMode, transformJson } from "./logic";

const example =
  '{"name":"Utility","ready":true,"tools":["markdown","base64","json"],"largeId":9007199254740993}';

export default function JsonTool() {
  const id = useId();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<JsonMode>("format");
  const [indentation, setIndentation] = useState<JsonIndent>("2");
  const result = useMemo(() => {
    if (!input.trim()) return { output: "", error: "" };
    try {
      return { output: transformJson(input, mode, indentation), error: "" };
    } catch (error) {
      return {
        output: "",
        error: error instanceof Error ? error.message : "Unable to parse this JSON.",
      };
    }
  }, [input, mode, indentation]);
  const hasResult = !!input.trim() && !result.error;

  function download() {
    const url = URL.createObjectURL(
      new Blob([result.output], { type: "application/json;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "formatted.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="tool-stack">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={mode} onValueChange={(value) => setMode(value as JsonMode)}>
          <TabsList aria-label="JSON output style">
            <TabsTrigger value="format">Format</TabsTrigger>
            <TabsTrigger value="minify">Minify</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${id}-indent`} className="text-muted-foreground">
            Indentation
          </Label>
          <Select
            value={indentation}
            onValueChange={(value) => setIndentation(value as JsonIndent)}
            disabled={mode === "minify"}
          >
            <SelectTrigger id={`${id}-indent`} className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 spaces</SelectItem>
              <SelectItem value="4">4 spaces</SelectItem>
              <SelectItem value="tab">Tabs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <ToolSplit resizeLabel="Resize JSON input and output panels">
        <ToolPanel
          title="JSON input"
          actions={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setInput(example)}>
                <Sparkles className="size-3.5" /> Example
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInput("")}
                disabled={!input}
                aria-label="Clear JSON"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </div>
          }
          footer="Validated as you type · strict JSON"
        >
          <Textarea
            className="tool-editor"
            aria-label="JSON input"
            aria-invalid={!!result.error}
            aria-describedby={result.error ? `${id}-error` : undefined}
            placeholder={'{ "paste": "your JSON here" }'}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </ToolPanel>
        <ToolPanel
          title={mode === "format" ? "Formatted JSON" : "Minified JSON"}
          actions={<CopyButton value={result.output} disabled={!hasResult} />}
          footer={
            hasResult ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Check className="size-3.5" /> Valid JSON
              </span>
            ) : (
              "Waiting for valid JSON"
            )
          }
        >
          <Textarea
            className="tool-editor"
            aria-label="JSON output"
            placeholder="Formatted JSON appears here."
            value={result.output}
            readOnly
            spellCheck={false}
          />
        </ToolPanel>
      </ToolSplit>
      {result.error && (
        <Alert variant="destructive" id={`${id}-error`}>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">Precision preserved</Badge>
          <span>Large integers and decimal values stay intact.</span>
        </div>
        <Button variant="outline" onClick={download} disabled={!hasResult}>
          <Download className="size-4" /> Download JSON
        </Button>
      </div>
    </div>
  );
}
