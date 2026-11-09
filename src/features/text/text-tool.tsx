import { ArrowLeft, Download } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolPanel } from "@/components/tools/tool-panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { countText, type TextOperation, textOperations, transformText } from "./text";

function downloadText(value: string) {
  const objectUrl = URL.createObjectURL(new Blob([value], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = "converted-text.txt";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

export default function TextTool() {
  const [input, setInput] = useState("");
  const [operation, setOperation] = useState<TextOperation>("lowercase");
  const output = transformText(input, operation);
  const counts = countText(input);
  const active = textOperations.find((item) => item.value === operation);

  return (
    <div className="tool-stack">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Characters", value: counts.characters },
          { label: "Words", value: counts.words },
          { label: "Lines", value: counts.lines },
          { label: "UTF-8 bytes", value: counts.bytes },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card px-4 py-3.5">
            <div className="font-mono text-xl font-semibold tabular-nums">
              {stat.value.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        {(["Case", "Lines"] as const).map((group) => (
          <div key={group} className="flex flex-wrap items-center gap-2 py-1.5">
            <span className="w-12 text-xs font-medium text-muted-foreground">{group}</span>
            {textOperations
              .filter((item) => item.group === group)
              .map((item) => (
                <Button
                  key={item.value}
                  size="sm"
                  variant={operation === item.value ? "secondary" : "ghost"}
                  aria-pressed={operation === item.value}
                  onClick={() => setOperation(item.value)}
                >
                  {item.label}
                </Button>
              ))}
          </div>
        ))}
      </div>

      <div className="tool-grid">
        <ToolPanel
          title="Original text"
          actions={
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setInput(
                    "Hello World\n  Make useful things.  \nHello World\n\nsmall tools, big ideas",
                  )
                }
              >
                Example
              </Button>
              <Button variant="ghost" size="sm" disabled={!input} onClick={() => setInput("")}>
                Clear
              </Button>
            </div>
          }
          footer="Character counts include visible characters, including combined emoji."
        >
          <Label htmlFor="text-input" className="sr-only">
            Original text
          </Label>
          <Textarea
            id="text-input"
            className="tool-editor"
            placeholder="Paste your text to start shaping it…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            spellCheck={false}
          />
        </ToolPanel>

        <ToolPanel
          title={active?.label ?? "Converted text"}
          actions={<CopyButton value={output} disabled={!output} />}
          footer={
            <div className="flex flex-wrap justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInput(output)}
                disabled={!output || output === input}
              >
                <ArrowLeft aria-hidden="true" className="size-3.5" /> Use as input
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadText(output)}
                disabled={!output}
              >
                <Download aria-hidden="true" className="size-3.5" /> Download
              </Button>
            </div>
          }
        >
          <Label htmlFor="text-output" className="sr-only">
            Converted text
          </Label>
          <Textarea
            id="text-output"
            className="tool-editor bg-muted/25"
            value={output}
            readOnly
            placeholder="Transformed text will appear here…"
            spellCheck={false}
          />
        </ToolPanel>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Line operations use LF line endings. Duplicate removal keeps the first exact match; use
        “Trim lines” first if spacing should be ignored.
      </p>
    </div>
  );
}
