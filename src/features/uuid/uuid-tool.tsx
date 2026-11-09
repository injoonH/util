import { AlertCircle, Download, RefreshCw } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolPanel } from "@/components/tools/tool-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateUuids } from "./uuid";

function initialUuid(): { values: string[]; error: string } {
  try {
    return { values: generateUuids(1), error: "" };
  } catch (caught) {
    return {
      values: [],
      error: caught instanceof Error ? caught.message : "UUID generation is unavailable.",
    };
  }
}

export default function UuidTool() {
  const [count, setCount] = useState("1");
  const [result, setResult] = useState(initialUuid);
  const output = result.values.join("\n");

  function generate(amount = Number(count)) {
    try {
      setResult({ values: generateUuids(amount), error: "" });
    } catch (caught) {
      setResult({
        values: [],
        error: caught instanceof Error ? caught.message : "Could not generate UUIDs.",
      });
    }
  }

  function download() {
    const objectUrl = URL.createObjectURL(new Blob([output], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "uuids.txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
  }

  return (
    <div className="tool-stack">
      <ToolPanel
        title="Generate UUIDs"
        description="Random version 4 identifiers, generated on your device."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            generate();
          }}
          className="flex flex-wrap items-end gap-4"
        >
          <div className="field-group w-36">
            <Label htmlFor="uuid-count">How many?</Label>
            <Input
              id="uuid-count"
              type="number"
              min={1}
              max={1000}
              step={1}
              value={count}
              onChange={(event) => setCount(event.target.value)}
              required
              aria-invalid={!!result.error}
              aria-describedby="uuid-count-help"
            />
          </div>
          <Button type="submit">
            <RefreshCw aria-hidden="true" className="size-4" /> Generate
          </Button>
          <div className="flex h-9 items-center gap-2">
            {[1, 10, 100].map((amount) => (
              <Button
                key={amount}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCount(String(amount));
                  generate(amount);
                }}
              >
                {amount}
              </Button>
            ))}
          </div>
        </form>
        <p id="uuid-count-help" className="mt-3 text-xs text-muted-foreground">
          Generate up to 1,000 UUIDs at a time.
        </p>
      </ToolPanel>

      {result.error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" />
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      )}

      <ToolPanel
        title="Your identifiers"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{result.values.length} generated</Badge>
            <CopyButton value={output} label="Copy all" disabled={!output} />
          </div>
        }
        footer={
          <div className="flex items-center justify-between gap-3">
            <span>One UUID per line · RFC 9562, version 4</span>
            <Button variant="ghost" size="sm" disabled={!output} onClick={download}>
              <Download aria-hidden="true" className="size-3.5" /> Download .txt
            </Button>
          </div>
        }
      >
        <Label htmlFor="uuid-output" className="sr-only">
          Generated UUIDs
        </Label>
        <Textarea
          id="uuid-output"
          className="tool-editor bg-muted/25 text-sm"
          value={output}
          readOnly
          spellCheck={false}
          placeholder="Generated UUIDs will appear here…"
        />
      </ToolPanel>
    </div>
  );
}
