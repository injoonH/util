import type { CreatedClipboard } from "@shared/clipboard";
import { useSyncExternalStore } from "react";

const storageKey = "utility:clipboard-receipts";
let snapshot: CreatedClipboard[] | undefined;
const listeners = new Set<() => void>();

function readSavedReceipts(): CreatedClipboard[] {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(saved)
      ? saved.filter(
          (value): value is CreatedClipboard =>
            value &&
            typeof value === "object" &&
            typeof value.token === "string" &&
            /^[a-f0-9]{48}$/.test(value.token) &&
            typeof value.deleteToken === "string" &&
            /^[a-f0-9]{48}$/.test(value.deleteToken) &&
            (value.code === null || typeof value.code === "string") &&
            typeof value.expiresAt === "string" &&
            Date.parse(value.expiresAt) > Date.now(),
        )
      : [];
  } catch {
    return [];
  }
}

function getSnapshot() {
  snapshot ??= readSavedReceipts();
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function update(next: CreatedClipboard[]) {
  snapshot = next;
  let persisted = true;
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    persisted = false;
  }
  for (const listener of listeners) listener();
  return persisted;
}

// This store outlives the tool component. A create request finishing after
// navigation still retains its deletion receipt and updates any remounted UI.
export function rememberShare(receipt: CreatedClipboard) {
  return update([
    receipt,
    ...getSnapshot().filter(
      (entry) => entry.token !== receipt.token && Date.parse(entry.expiresAt) > Date.now(),
    ),
  ]);
}

export function forgetShare(token: string) {
  update(
    getSnapshot().filter(
      (entry) => entry.token !== token && Date.parse(entry.expiresAt) > Date.now(),
    ),
  );
}

export function useShareReceipts() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
