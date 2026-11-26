import { describe, expect, it } from "vitest";
import { MAXIMUM_UNIT_COUNT, parseUnitCount } from "@/modules/knowledge/domain/unit-count";

describe("parseUnitCount", () => {
  it("allows at most 5000 units", () => {
    expect(MAXIMUM_UNIT_COUNT).toBe(5000);
  });

  it.each([
    ["1", 1],
    ["120", 120],
    ["5000", 5000],
    ["4999", 4999],
  ])("accepts %j as %i", (rawUnitCount, unitCount) => {
    expect(parseUnitCount(rawUnitCount)).toEqual({ isValid: true, unitCount });
  });

  it.each([
    [" 12 ", 12],
    ["\t7\n", 7],
    ["05", 5],
    ["0005000", 5000],
    ["000000000000000000001", 1],
  ])("ignores surrounding whitespace and leading zeros: %j is %i", (rawUnitCount, unitCount) => {
    expect(parseUnitCount(rawUnitCount)).toEqual({ isValid: true, unitCount });
  });

  it.each([
    ["an empty text", ""],
    ["only spaces", "   "],
  ])("rejects %s as a missing number", (_description, rawUnitCount) => {
    expect(parseUnitCount(rawUnitCount)).toEqual({
      isValid: false,
      issue: { field: "unitCount", code: "UNIT_COUNT_REQUIRED" },
    });
  });

  it.each([
    ["a plus sign", "+12"],
    ["a minus sign", "-12"],
    ["a decimal point", "7.0"],
    ["a decimal comma", "7,5"],
    ["an exponent", "1e3"],
    ["a thousands separator", "1,000"],
    ["an inner space", "1 000"],
    ["an underscore separator", "1_000"],
    ["a hexadecimal number", "0x10"],
    ["text", "twelve"],
    ["digits followed by text", "12 chapters"],
    ["non-ASCII digits", "١٢"],
    ["full-width digits", "１２"],
    ["infinity", "Infinity"],
  ])("rejects %s as an invalid number", (_description, rawUnitCount) => {
    expect(parseUnitCount(rawUnitCount)).toEqual({
      isValid: false,
      issue: { field: "unitCount", code: "UNIT_COUNT_INVALID" },
    });
  });

  it.each([
    ["zero", "0"],
    ["only zeros", "0000"],
    ["one above the maximum", "5001"],
    ["a value beyond any integer range", "99999999999999999999999999999999"],
    ["a value beyond the maximum with leading zeros", "0005001"],
  ])("rejects %s as out of range", (_description, rawUnitCount) => {
    expect(parseUnitCount(rawUnitCount)).toEqual({
      isValid: false,
      issue: { field: "unitCount", code: "UNIT_COUNT_OUT_OF_RANGE" },
    });
  });
});
