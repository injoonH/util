export type UrlMode = "encode" | "decode" | "inspect";

export function transformUrlComponent(value: string, mode: "encode" | "decode"): string {
  try {
    return mode === "encode" ? encodeURIComponent(value) : decodeURIComponent(value);
  } catch {
    throw new Error(
      mode === "decode"
        ? "This text contains an invalid percent-encoded sequence. Check the input and try again."
        : "This text contains an incomplete Unicode character and cannot be encoded.",
    );
  }
}

export type InspectedUrl = {
  normalized: string;
  fields: { label: string; value: string }[];
  parameters: { id: string; key: string; value: string }[];
};

export function inspectUrl(value: string): InspectedUrl {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("Enter an absolute URL, including its scheme, such as https://example.com.");
  }

  const occurrences = new Map<string, number>();
  const parameters = Array.from(parsed.searchParams.entries(), ([key, parameterValue]) => {
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    return { id: `${key}:${occurrence}`, key, value: parameterValue };
  });

  return {
    normalized: parsed.href,
    fields: [
      { label: "Scheme", value: parsed.protocol },
      { label: "Hostname", value: parsed.hostname || "—" },
      { label: "Port", value: parsed.port || "Default" },
      { label: "Path", value: parsed.pathname || "/" },
      { label: "Fragment", value: parsed.hash.slice(1) || "—" },
    ],
    parameters,
  };
}
