import { describe, expect, it } from "vitest";
import { parseUnitNumber } from "@/modules/knowledge/domain/unit-number";

const FIELD = "boundary.unitNumber";

describe("parseUnitNumber", () => {
  it.each([
    ["1", 1],
    ["12", 12],
    ["5000", 5000],
  ])("reads %j as unit %i", (rawUnitNumber, unitNumber) => {
    expect(parseUnitNumber(rawUnitNumber, FIELD)).toEqual({ isValid: true, unitNumber });
  });

  it.each([
    [" 7 ", 7],
    ["\t7\n", 7],
    ["007", 7],
    ["000000000000000000001", 1],
  ])("ignores surrounding whitespace and leading zeros: %j is unit %i", (rawUnitNumber, unitNumber) => {
    expect(parseUnitNumber(rawUnitNumber, FIELD)).toEqual({ isValid: true, unitNumber });
  });

  it.each([
    ["zero", "0"],
    ["only zeros", "000"],
    ["one above the largest work", "5001"],
    ["a value beyond any integer range", "99999999999999999999999999999999"],
  ])("reads %s as well formed but naming no unit of any work", (_description, rawUnitNumber) => {
    expect(parseUnitNumber(rawUnitNumber, FIELD)).toEqual({ isValid: true, unitNumber: null });
  });

  it.each([
    ["an empty text", ""],
    ["only spaces", "   "],
  ])("rejects %s as a missing number on the given field", (_description, rawUnitNumber) => {
    expect(parseUnitNumber(rawUnitNumber, FIELD)).toEqual({
      isValid: false,
      issue: { field: FIELD, code: "UNIT_NUMBER_REQUIRED" },
    });
  });

  it.each([
    ["a plus sign", "+7"],
    ["a minus sign", "-7"],
    ["a decimal point", "7.0"],
    ["an exponent", "1e3"],
    ["a thousands separator", "1,000"],
    ["an inner space", "1 2"],
    ["a hexadecimal number", "0x10"],
    ["text", "seven"],
    ["non-ASCII digits", "١٢"],
    ["full-width digits", "１２"],
  ])("rejects %s as an invalid number", (_description, rawUnitNumber) => {
    expect(parseUnitNumber(rawUnitNumber, FIELD)).toEqual({
      isValid: false,
      issue: { field: FIELD, code: "UNIT_NUMBER_INVALID" },
    });
  });

  it("reports the issue on the field it is given", () => {
    expect(parseUnitNumber("x", "fragment.boundary.unitNumber")).toMatchObject({
      issue: { field: "fragment.boundary.unitNumber" },
    });
  });
});
