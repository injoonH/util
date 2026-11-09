export type EpochUnit = "seconds" | "milliseconds";

const MAX_DATE_MS = 8_640_000_000_000_000n;

export function parseEpoch(value: string, unit: EpochUnit): number {
  const trimmed = value.trim();
  const match = (unit === "seconds" ? /^([+-]?)(\d+)(?:\.(\d{1,3}))?$/ : /^([+-]?)(\d+)$/).exec(
    trimmed,
  );
  if (!match) {
    throw new Error(
      unit === "seconds"
        ? "Enter Unix seconds as a number, with up to three decimal places."
        : "Enter Unix milliseconds as a whole number.",
    );
  }
  const digits = (match[2] ?? "0").replace(/^0+(?=\d)/, "");
  if (digits.length > 20) {
    throw new Error("This timestamp is outside the supported date range.");
  }
  const whole = BigInt(digits);
  const absolute =
    unit === "seconds" ? whole * 1_000n + BigInt((match[3] ?? "").padEnd(3, "0")) : whole;
  const milliseconds = match[1] === "-" ? -absolute : absolute;
  if (milliseconds < -MAX_DATE_MS || milliseconds > MAX_DATE_MS) {
    throw new Error("This timestamp is outside the supported date range.");
  }
  return Number(milliseconds);
}

export function secondsFromMilliseconds(milliseconds: number): string {
  if (!Number.isSafeInteger(milliseconds)) {
    throw new Error("A valid whole millisecond value is required.");
  }
  const absolute = BigInt(Math.abs(milliseconds));
  const whole = absolute / 1_000n;
  const fraction = (absolute % 1_000n).toString().padStart(3, "0").replace(/0+$/, "");
  return `${milliseconds < 0 ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function utcInputFromMilliseconds(milliseconds: number): string {
  return new Date(milliseconds).toISOString().slice(0, -1);
}

export function parseUtcDate(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(
    value,
  );
  if (!match) {
    throw new Error("Enter a complete UTC date and time.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  const millisecond = Number((match[7] ?? "").padEnd(3, "0"));
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    throw new Error("This is not a valid UTC date and time.");
  }
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millisecond);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("This calendar date does not exist.");
  }
  return date.getTime();
}

export function formatInTimeZone(milliseconds: number, timeZone: string): string {
  const date = new Date(milliseconds);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timeZone === "local" ? undefined : timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hourCycle: "h23",
    timeZoneName: "shortOffset",
    era: date.getUTCFullYear() < 1 ? "short" : undefined,
  }).format(date);
}
