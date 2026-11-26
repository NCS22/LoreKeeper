import { describe, expect, it } from "vitest";
import { buildNumberedUnits, UNIT_ORDINAL_STEP } from "@/modules/knowledge/domain/numbered-units";

describe("buildNumberedUnits", () => {
  it("leaves gaps of 1000 between ordinals", () => {
    expect(UNIT_ORDINAL_STEP).toBe(1000);
  });

  it("builds one unit labelled 1 for a work of one unit", () => {
    expect(buildNumberedUnits(1)).toEqual([{ label: "1", ordinal: 1000 }]);
  });

  it("labels the units 1 to N in order, with ordinals in steps of 1000", () => {
    expect(buildNumberedUnits(3)).toEqual([
      { label: "1", ordinal: 1000 },
      { label: "2", ordinal: 2000 },
      { label: "3", ordinal: 3000 },
    ]);
  });

  it("builds 5000 units, the last labelled 5000 with ordinal 5000000", () => {
    const units = buildNumberedUnits(5000);

    expect(units).toHaveLength(5000);
    expect(units.at(-1)).toEqual({ label: "5000", ordinal: 5_000_000 });
    expect(new Set(units.map((unit) => unit.label)).size).toBe(5000);
  });
});
