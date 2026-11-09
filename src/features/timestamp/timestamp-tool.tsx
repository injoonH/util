import { AlertCircle, Clock3 } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolPanel } from "@/components/tools/tool-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type EpochUnit,
  formatInTimeZone,
  parseEpoch,
  parseUtcDate,
  secondsFromMilliseconds,
  utcInputFromMilliseconds,
} from "./timestamp";

const timeZones = [
  { value: "UTC", label: "UTC" },
  { value: "local", label: "Your local timezone" },
  { value: "Asia/Seoul", label: "Seoul · Asia/Seoul" },
  { value: "Asia/Tokyo", label: "Tokyo · Asia/Tokyo" },
  { value: "Europe/London", label: "London · Europe/London" },
  { value: "America/New_York", label: "New York · America/New_York" },
  { value: "America/Los_Angeles", label: "Los Angeles · America/Los_Angeles" },
];

function ResultField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <CopyButton value={value} disabled={!value} />
      </div>
      <div className="break-all font-mono text-sm leading-relaxed">{value || "—"}</div>
    </div>
  );
}

export default function TimestampTool() {
  const [initialNow] = useState(() => Date.now());
  const [mode, setMode] = useState("epoch");
  const [unit, setUnit] = useState<EpochUnit>("seconds");
  const [epoch, setEpoch] = useState(() => secondsFromMilliseconds(initialNow));
  const [dateInput, setDateInput] = useState(() => utcInputFromMilliseconds(initialNow));
  const [timeZone, setTimeZone] = useState("UTC");
  let milliseconds: number | null = null;
  let error = "";
  const hasInput = mode === "epoch" ? epoch.trim().length > 0 : dateInput.length > 0;

  if (hasInput) {
    try {
      milliseconds = mode === "epoch" ? parseEpoch(epoch, unit) : parseUtcDate(dateInput);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Unable to convert this date.";
    }
  }

  function applyCurrentTime() {
    const now = Date.now();
    setEpoch(unit === "seconds" ? secondsFromMilliseconds(now) : String(now));
    setDateInput(utcInputFromMilliseconds(now));
  }

  function changeUnit(next: EpochUnit) {
    if (milliseconds !== null && mode === "epoch") {
      setEpoch(next === "seconds" ? secondsFromMilliseconds(milliseconds) : String(milliseconds));
    }
    setUnit(next);
  }

  return (
    <div className="tool-stack">
      <div className="tool-grid">
        <ToolPanel
          title="Convert a moment"
          description="Choose your input format. Results update as you type."
          actions={
            <Button size="sm" variant="outline" onClick={applyCurrentTime}>
              <Clock3 aria-hidden="true" className="size-3.5" /> Now
            </Button>
          }
        >
          <Tabs value={mode} onValueChange={setMode} className="space-y-5">
            <TabsList className="w-full">
              <TabsTrigger value="epoch" className="flex-1">
                Timestamp → date
              </TabsTrigger>
              <TabsTrigger value="date" className="flex-1">
                Date → timestamp
              </TabsTrigger>
            </TabsList>
            <TabsContent value="epoch" className="space-y-5">
              <div className="field-group">
                <Label htmlFor="epoch-unit">Timestamp unit</Label>
                <Select value={unit} onValueChange={(value) => changeUnit(value as EpochUnit)}>
                  <SelectTrigger id="epoch-unit" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">Seconds</SelectItem>
                    <SelectItem value="milliseconds">Milliseconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="field-group">
                <Label htmlFor="epoch-input">Unix {unit}</Label>
                <Input
                  id="epoch-input"
                  className="font-mono"
                  inputMode="decimal"
                  placeholder={unit === "seconds" ? "1700000000" : "1700000000000"}
                  value={epoch}
                  onChange={(event) => setEpoch(event.target.value)}
                  aria-invalid={!!error}
                  aria-describedby={error ? "timestamp-error" : "epoch-help"}
                />
                <p id="epoch-help" className="text-xs leading-relaxed text-muted-foreground">
                  {unit === "seconds"
                    ? "Fractional seconds are supported to millisecond precision."
                    : "Enter a whole number of milliseconds."}{" "}
                  Negative values represent dates before 1970.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEpoch("0")}>
                Try the Unix epoch →
              </Button>
            </TabsContent>
            <TabsContent value="date" className="space-y-5">
              <div className="field-group">
                <Label htmlFor="utc-date-input">Date and time (UTC)</Label>
                <Input
                  id="utc-date-input"
                  type="datetime-local"
                  step="0.001"
                  min="0001-01-01T00:00"
                  max="9999-12-31T23:59:59.999"
                  value={dateInput}
                  onChange={(event) => setDateInput(event.target.value)}
                  aria-invalid={!!error}
                  aria-describedby={error ? "timestamp-error" : "utc-date-help"}
                />
                <p id="utc-date-help" className="text-xs leading-relaxed text-muted-foreground">
                  This input is always interpreted as UTC. The display timezone below changes only
                  how the result is shown.
                </p>
              </div>
            </TabsContent>
          </Tabs>
          <div className="field-group mt-6 border-t border-border pt-5">
            <Label htmlFor="display-timezone">Display timezone</Label>
            <Select value={timeZone} onValueChange={setTimeZone}>
              <SelectTrigger id="display-timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeZones.map((zone) => (
                  <SelectItem key={zone.value} value={zone.value}>
                    {zone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </ToolPanel>

        <ToolPanel
          title="Same moment, different formats"
          description="Unix timestamps always represent UTC-based instants."
        >
          <div className="space-y-3" aria-live="polite">
            <ResultField
              label="Unix seconds"
              value={milliseconds !== null ? secondsFromMilliseconds(milliseconds) : ""}
            />
            <ResultField
              label="Unix milliseconds"
              value={milliseconds !== null ? String(milliseconds) : ""}
            />
            <ResultField
              label="ISO 8601 · UTC"
              value={milliseconds !== null ? new Date(milliseconds).toISOString() : ""}
            />
            <ResultField
              label={
                timeZone === "local"
                  ? `Local · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
                  : timeZone
              }
              value={milliseconds !== null ? formatInTimeZone(milliseconds, timeZone) : ""}
            />
          </div>
        </ToolPanel>
      </div>
      {error && (
        <Alert variant="destructive" id="timestamp-error" role="alert">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
