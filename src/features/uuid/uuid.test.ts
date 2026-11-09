import { describe, expect, it } from "vitest";
import { generateUuids } from "./uuid";

describe("UUID generation", () => {
  it("generates valid random version 4 UUIDs", () => {
    const values = generateUuids(20);
    expect(new Set(values).size).toBe(20);
    for (const value of values) {
      expect(value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it("honors the batch size", () => {
    let count = 0;
    expect(generateUuids(1_000, () => `id-${++count}`)).toHaveLength(1_000);
    expect(count).toBe(1_000);
  });

  it.each([0, -1, 1.5, 1_001, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid count %s",
    (count) => {
      expect(() => generateUuids(count)).toThrow("whole number");
    },
  );
});
