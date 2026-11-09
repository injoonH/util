import { ArrowLeftRight, RotateCcw, Sparkles } from "lucide-react";
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
import { type Base64Variant, decodeBase64, encodeBase64 } from "./logic";

export default function Base64Tool() {
  const id = useId();
  const [input, setInput] = useState("");
  const [operation, setOperation] = useState("encode");
  const [variant, setVariant] = useState<Base64Variant>("base64");
  const result = useMemo(() => {
    try {
      return {
        output:
          operation === "encode" ? encodeBase64(input, variant) : decodeBase64(input, variant),
        error: "",
      };
    } catch (error) {
      return {
        output: "",
        error: error instanceof Error ? error.message : "Unable to convert text.",
      };
    }
  }, [input, operation, variant]);

  function swap() {
    if (result.error) return;
    setInput(result.output);
    setOperation(operation === "encode" ? "decode" : "encode");
  }

  return (
    <div className="tool-stack">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={operation} onValueChange={setOperation}>
          <TabsList aria-label="Conversion direction">
            <TabsTrigger value="encode">Encode</TabsTrigger>
            <TabsTrigger value="decode">Decode</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${id}-variant`} className="text-muted-foreground">
            Alphabet
          </Label>
          <Select value={variant} onValueChange={(value) => setVariant(value as Base64Variant)}>
            <SelectTrigger id={`${id}-variant`} className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base64">Base64</SelectItem>
              <SelectItem value="base64url">Base64URL</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <ToolSplit resizeLabel="Resize Base64 input and output panels">
        <ToolPanel
          title={operation === "encode" ? "Original text" : "Encoded text"}
          actions={
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setInput(
                    operation === "encode"
                      ? "Hello, world! 안녕하세요 👋"
                      : encodeBase64("Hello, world! 안녕하세요 👋", variant),
                  )
                }
              >
                <Sparkles className="size-3.5" /> Example
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInput("")}
                disabled={!input}
                aria-label="Clear input"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </div>
          }
          footer={`${new TextEncoder().encode(input).length.toLocaleString()} UTF-8 bytes`}
        >
          <Textarea
            className="tool-editor"
            aria-label={operation === "encode" ? "Text to encode" : "Base64 to decode"}
            placeholder={
              operation === "encode" ? "Type or paste text here…" : "Paste a Base64 value here…"
            }
            value={input}
            onChange={(event) => setInput(event.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </ToolPanel>
        <ToolPanel
          title={operation === "encode" ? "Encoded result" : "Decoded text"}
          actions={<CopyButton value={result.output} disabled={!!result.error || !input} />}
          footer={
            <div className="flex items-center justify-between gap-2">
              <span>{Array.from(result.output).length.toLocaleString()} characters</span>
              <Badge variant="outline">UTF-8</Badge>
            </div>
          }
        >
          <Textarea
            className="tool-editor"
            aria-label="Conversion result"
            placeholder="Your result appears here as you type."
            value={result.output}
            readOnly
            spellCheck={false}
          />
        </ToolPanel>
      </ToolSplit>
      {result.error && (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {variant === "base64url"
            ? "URL-safe output uses - and _ and omits padding."
            : "Wrapped lines and omitted padding are accepted when decoding."}
        </p>
        <Button variant="outline" onClick={swap} disabled={!!result.error || !input}>
          <ArrowLeftRight className="size-4" /> Use result as input
        </Button>
      </div>
    </div>
  );
}
