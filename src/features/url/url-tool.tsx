import { AlertCircle, ArrowDownUp, Link2 } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolPanel } from "@/components/tools/tool-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { type InspectedUrl, inspectUrl, transformUrlComponent, type UrlMode } from "./url";

const modes = ["encode", "decode", "inspect"] as const;
const examples = {
  encode: "Hello, world! 안녕하세요 👋",
  decode: "Hello%2C%20world!%20%EC%95%88%EB%85%95%ED%95%98%EC%84%B8%EC%9A%94%20%F0%9F%91%8B",
  inspect: "https://example.com/search?tag=design&tag=code&q=hello+world#results",
};

export default function UrlTool() {
  const [mode, setMode] = useState<UrlMode>("encode");
  const [input, setInput] = useState("");
  let output = "";
  let inspection: InspectedUrl | null = null;
  let error = "";

  if (input) {
    try {
      if (mode === "inspect") inspection = inspectUrl(input);
      else output = transformUrlComponent(input, mode);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Unable to process this input.";
    }
  }

  function swap() {
    if (!output || mode === "inspect") return;
    setInput(output);
    setMode(mode === "encode" ? "decode" : "encode");
  }

  return (
    <Tabs value={mode} onValueChange={(value) => setMode(value as UrlMode)} className="tool-stack">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="encode">Encode</TabsTrigger>
          <TabsTrigger value="decode">Decode</TabsTrigger>
          <TabsTrigger value="inspect">Inspect URL</TabsTrigger>
        </TabsList>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setInput(examples[mode])}>
            Load example
          </Button>
          <Button variant="outline" size="sm" onClick={() => setInput("")} disabled={!input}>
            Clear
          </Button>
        </div>
      </div>

      {modes.map((tab) => (
        <TabsContent key={tab} value={tab} className="tool-stack mt-0">
          <div className="tool-grid">
            <ToolPanel
              title={mode === "inspect" ? "URL to inspect" : "Input"}
              description={
                mode === "inspect"
                  ? "Paste a complete URL to see its parts."
                  : "Convert a query value, path segment, or other URL component."
              }
              actions={
                mode !== "inspect" ? (
                  <Button size="sm" variant="ghost" onClick={swap} disabled={!output || !!error}>
                    <ArrowDownUp aria-hidden="true" className="size-3.5" /> Swap
                  </Button>
                ) : undefined
              }
              footer={
                mode === "decode"
                  ? "+ stays literal in component mode. The URL inspector reads query strings using form-style decoding."
                  : "All processing happens in your browser."
              }
            >
              <Label htmlFor={`url-input-${tab}`} className="sr-only">
                {mode === "inspect" ? "URL to inspect" : "URL component input"}
              </Label>
              <Textarea
                id={`url-input-${tab}`}
                className="tool-editor"
                placeholder={
                  mode === "inspect"
                    ? "https://example.com/path?key=value"
                    : mode === "decode"
                      ? "Paste percent-encoded text here…"
                      : "Type or paste text here…"
                }
                value={input}
                onChange={(event) => setInput(event.target.value)}
                spellCheck={false}
                aria-invalid={!!error}
                aria-describedby={error ? `url-error-${tab}` : undefined}
              />
            </ToolPanel>

            {mode === "inspect" ? (
              <ToolPanel
                title="URL details"
                actions={<CopyButton value={inspection?.normalized ?? ""} disabled={!inspection} />}
              >
                {inspection ? (
                  <div className="space-y-5">
                    <dl className="divide-y divide-border">
                      {inspection.fields.map((field) => (
                        <div
                          key={field.label}
                          className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 py-3 first:pt-0"
                        >
                          <dt className="text-xs font-medium text-muted-foreground">
                            {field.label}
                          </dt>
                          <dd className="break-all font-mono text-sm">{field.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div>
                      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                        Query parameters{" "}
                        <Badge variant="secondary">{inspection.parameters.length}</Badge>
                      </div>
                      {inspection.parameters.length ? (
                        <dl className="overflow-hidden rounded-lg border border-border">
                          {inspection.parameters.map((parameter) => (
                            <div
                              key={parameter.id}
                              className="grid grid-cols-2 gap-3 border-b border-border px-3 py-2.5 last:border-0"
                            >
                              <dt className="break-all font-mono text-xs font-medium">
                                {parameter.key || "(empty key)"}
                              </dt>
                              <dd className="break-all font-mono text-xs text-muted-foreground">
                                {parameter.value || "(empty value)"}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          This URL has no query parameters.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                    <Link2 aria-hidden="true" className="size-7 opacity-40" />
                    <p className="text-sm">The URL’s parts will appear here.</p>
                  </div>
                )}
              </ToolPanel>
            ) : (
              <ToolPanel
                title={mode === "encode" ? "Encoded output" : "Decoded output"}
                actions={<CopyButton value={output} disabled={!output || !!error} />}
              >
                <Label htmlFor={`url-output-${tab}`} className="sr-only">
                  URL conversion output
                </Label>
                <Textarea
                  id={`url-output-${tab}`}
                  className="tool-editor bg-muted/25"
                  value={output}
                  readOnly
                  placeholder="Your result appears here…"
                  spellCheck={false}
                />
              </ToolPanel>
            )}
          </div>
          {error && (
            <Alert variant="destructive" id={`url-error-${tab}`} role="alert">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
