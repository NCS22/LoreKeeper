// What the unit picker of the knowledge forms picks for a typed number (spec 006, FR-4; plan section 5).
// It only decides what the screen shows while the person types: the text is sent as typed, and the
// server applies the rules of the number and looks the unit up (plan section 4, D6).

export type TypedUnitNumberResolution =
  /** Nothing typed yet (or only spaces): no unit is picked, and nothing is wrong yet. */
  | { readonly status: "empty" }
  | { readonly status: "resolved"; readonly unitNumber: number }
  /** The text names no unit of the work: not only digits, 0, or above its number of units. */
  | { readonly status: "no-unit" };

const ASCII_DIGITS_ONLY = /^[0-9]+$/u;
const LEADING_ZEROS = /^0+/u;

/**
 * Resolves a typed unit number against a work of `unitCount` units, with the format of N in FR-1:
 * surrounding spaces ignored, digits 0 to 9 only, leading zeros allowed. The digits are compared
 * before any conversion, so a value beyond any integer range never rounds into a real unit.
 */
export function resolveTypedUnitNumber(typedUnitNumber: string, unitCount: number): TypedUnitNumberResolution {
  const digits = typedUnitNumber.trim();
  if (digits.length === 0) return { status: "empty" };
  if (!ASCII_DIGITS_ONLY.test(digits)) return { status: "no-unit" };

  const significantDigits = digits.replace(LEADING_ZEROS, "");
  if (significantDigits.length === 0 || significantDigits.length > String(unitCount).length) {
    return { status: "no-unit" };
  }

  const unitNumber = Number(significantDigits);
  return unitNumber <= unitCount ? { status: "resolved", unitNumber } : { status: "no-unit" };
}
