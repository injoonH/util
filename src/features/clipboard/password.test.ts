import { describe, expect, it } from "vitest";
import { createPasswordSalt, derivePasswordKey, validateNewPassword } from "./password";

describe("clipboard password derivation", () => {
  it("matches independent PBKDF2-SHA256 and preserves Unicode and spaces", async () => {
    const salt = "01".repeat(16);
    const password = "  private 🗝️ note  ";
    // Reference generated independently with node:crypto.pbkdf2Sync, UTF-8,
    // 600,000 iterations, a 16-byte 0x01 salt, and a 32-byte SHA-256 output.
    const expected = "ea492509d1875fa9732863b0593e54aa2f023fa114d2041c39849a343443200d";
    expect(await derivePasswordKey(password, salt)).toBe(expected);
    expect(await derivePasswordKey(password, "02".repeat(16))).not.toBe(expected);
  });
  it("creates random 128-bit salts and validates password input without truncating", async () => {
    const first = createPasswordSalt();
    expect(first).toMatch(/^[a-f0-9]{32}$/);
    expect(createPasswordSalt()).not.toBe(first);
    expect(validateNewPassword("short")).toContain("8 characters");
    expect(validateNewPassword(" ".repeat(8))).toBeTruthy();
    expect(validateNewPassword("x".repeat(257))).toContain("256");
    expect(validateNewPassword("A memorable password")).toBeNull();
    await expect(derivePasswordKey("test", "invalid salt")).rejects.toThrow();
  });
});
