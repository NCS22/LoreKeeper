import type { ValidationIssue } from "@/shared/domain/validation-error";
import { MAXIMUM_UNIT_COUNT } from "./unit-count";

export const UNIT_NUMBER_REQUIRED_CODE = "UNIT_NUMBER_REQUIRED";
export const UNIT_NUMBER_INVALID_CODE = "UNIT_NUMBER_INVALID";

/**
 * A typed unit number. `unitNumber` is `null` when the text is well formed but can name no unit of
 * any work (0, or above the largest number of units a work can have): it is not a validation
 * failure, it simply matches no unit, which the use case answers with the single not found.
 */
export type UnitNumberParsing =
  | { readonly isValid: true; readonly unitNumber: number | null }
  | { readonly isValid: false; readonly issue: ValidationIssue };

const ASCII_DIGITS_ONLY = /^[0-9]+$/u;
const LEADING_ZEROS = /^0+/u;
const MAXIMUM_UNIT_NUMBER_DIGITS = String(MAXIMUM_UNIT_COUNT).length;

/**
 * Reads the number of a unit as typed, with the format rules of the number of units of a work
 * (FR-1, FR-4): surrounding whitespace is ignored, only the digits 0 to 9 are allowed (no sign,
 * decimal point, exponent or separator) and leading zeros are allowed. The digits are compared
 * before any conversion, so a value beyond any integer range is never rounded into a real unit.
 * The issue, if any, is reported on `field` (the path of the boundary in the input).
 */
export function parseUnitNumber(rawUnitNumber: string, field: string): UnitNumberParsing {
  const digits = rawUnitNumber.trim();

  if (digits.length === 0) {
    return { isValid: false, issue: { field, code: UNIT_NUMBER_REQUIRED_CODE } };
  }

  if (!ASCII_DIGITS_ONLY.test(digits)) {
    return { isValid: false, issue: { field, code: UNIT_NUMBER_INVALID_CODE } };
  }

  const significantDigits = digits.replace(LEADING_ZEROS, "");
  if (significantDigits.length === 0 || significantDigits.length > MAXIMUM_UNIT_NUMBER_DIGITS) {
    return { isValid: true, unitNumber: null };
  }

  const unitNumber = Number(significantDigits);
  return { isValid: true, unitNumber: unitNumber > MAXIMUM_UNIT_COUNT ? null : unitNumber };
}
