export function generateUuids(count: number, generator?: () => string): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 1_000) {
    throw new Error("Choose a whole number from 1 to 1,000.");
  }

  const randomUuid =
    generator ??
    (() => {
      if (!globalThis.crypto?.randomUUID) {
        throw new Error(
          "UUID generation requires a browser with crypto.randomUUID and a secure HTTPS connection.",
        );
      }
      return globalThis.crypto.randomUUID();
    });

  return Array.from({ length: count }, () => randomUuid());
}
