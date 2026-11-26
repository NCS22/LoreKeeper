import { describe, expect, it } from "vitest";
import { resolveTypedUnitNumber } from "@/components/knowledge/resolve-typed-unit-number";

// The unit picker of the knowledge forms resolves the typed number against the units of the chosen
// work (spec 006, FR-4): the format rules of N in FR-1, and a number within 1 to the number of units.

describe("resolveTypedUnitNumber", () => {
  it.each([
    ["a plain number", "7", 7],
    ["a number with surrounding spaces", " 7 ", 7],
    ["a number with leading zeros", "007", 7],
    ["the first unit", "1", 1],
    ["the last unit", "120", 120],
    ["the last unit with leading zeros and spaces", "  0120\t", 120],
  ])("picks the unit of %s", (_description, typedUnitNumber, expectedUnitNumber) => {
    expect(resolveTypedUnitNumber(typedUnitNumber, 120)).toEqual({ status: "resolved", unitNumber: expectedUnitNumber });
  });

  it("picks the unit 5000 of a work of 5000 units", () => {
    expect(resolveTypedUnitNumber("5000", 5000)).toEqual({ status: "resolved", unitNumber: 5000 });
  });

  it.each([
    ["one above the number of units", "121"],
    ["zero", "0"],
    ["only zeros", "000"],
    ["an exponent", "1e3"],
    ["a plus sign", "+7"],
    ["a minus sign", "-7"],
    ["a decimal", "7.0"],
    ["a thousands separator", "1,000"],
    ["a space inside the number", "1 2"],
    ["digits that are not 0 to 9", String.fromCodePoint(0x0667)],
    ["a value beyond any integer range", "99999999999999999999999"],
    ["letters", "seven"],
  ])("picks nothing for %s", (_description, typedUnitNumber) => {
    expect(resolveTypedUnitNumber(typedUnitNumber, 120)).toEqual({ status: "no-unit" });
  });

  it.each([
    ["nothing typed", ""],
    ["only spaces", "   "],
  ])("reads %s as no number yet, not as a wrong one", (_description, typedUnitNumber) => {
    expect(resolveTypedUnitNumber(typedUnitNumber, 120)).toEqual({ status: "empty" });
  });

  it("picks nothing in a work of one unit for any number but 1", () => {
    expect(resolveTypedUnitNumber("1", 1)).toEqual({ status: "resolved", unitNumber: 1 });
    expect(resolveTypedUnitNumber("2", 1)).toEqual({ status: "no-unit" });
  });
});
