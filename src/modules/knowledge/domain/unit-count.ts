import type { ValidationIssue } from "@/shared/domain/validation-error";

export const MAXIMUM_UNIT_COUNT = 5000;

export const UNIT_COUNT_FIELD = "unitCount";
export const UNIT_COUNT_REQUIRED_CODE = "UNIT_COUNT_REQUIRED";
export const UNIT_COUNT_INVALID_CODE = "UNIT_COUNT_INVALID";
export const UNIT_COUNT_OUT_OF_RANGE_CODE = "UNIT_COUNT_OUT_OF_RANGE";

export type UnitCountParsing =
  | { readonly isValid: true; readonly unitCount: number }
  | { readonly isValid: false; readonly issue: ValidationIssue };

const ASCII_DIGITS_ONLY = /^[0-9]+$/u;
const LEADING_ZEROS = /^0+/u;
const MAXIMUM_UNIT_COUNT_DIGITS = String(MAXIMUM_UNIT_COUNT).length;

/**
 * Reads the number of units of a work as typed (FR-1): surrounding whitespace is ignored, only the
 * digits 0 to 9 are allowed (no sign, decimal point, exponent or separator), leading zeros are
 * allowed, and the value must be from 1 to the maximum. The digits are compared before any
 * conversion, so a value beyond any integer range is out of range, never rounded.
 */
export function parseUnitCount(rawUnitCount: string): UnitCountParsing {
  const digits = rawUnitCount.trim();

  if (digits.length === 0) {
    return refuse(UNIT_COUNT_REQUIRED_CODE);
  }

  if (!ASCII_DIGITS_ONLY.test(digits)) {
    return refuse(UNIT_COUNT_INVALID_CODE);
  }

  const significantDigits = digits.replace(LEADING_ZEROS, "");
  if (significantDigits.length === 0 || significantDigits.length > MAXIMUM_UNIT_COUNT_DIGITS) {
    return refuse(UNIT_COUNT_OUT_OF_RANGE_CODE);
  }

  const unitCount = Number(significantDigits);
  if (unitCount > MAXIMUM_UNIT_COUNT) {
    return refuse(UNIT_COUNT_OUT_OF_RANGE_CODE);
  }

  return { isValid: true, unitCount };
}

function refuse(code: string): UnitCountParsing {
  return { isValid: false, issue: { field: UNIT_COUNT_FIELD, code } };
}
