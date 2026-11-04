import type { ValidationIssue } from "@/shared/domain/validation-error";

export const MAXIMUM_UNIVERSE_NAME_LENGTH = 120;

export const UNIVERSE_NAME_FIELD = "name";
export const UNIVERSE_NAME_REQUIRED_CODE = "NAME_REQUIRED";
export const UNIVERSE_NAME_TOO_LONG_CODE = "NAME_TOO_LONG";

export type UniverseNameValidation =
  | { readonly isValid: true; readonly name: string }
  | { readonly isValid: false; readonly issue: ValidationIssue };

/** Characters are counted as Unicode code points, so an emoji counts as one. */
function countCharacters(text: string): number {
  return Array.from(text).length;
}

/**
 * Applies the name rules: surrounding whitespace is removed, the result must not be
 * empty and its length, counted after trimming, must not exceed the maximum.
 */
export function validateUniverseName(rawName: string): UniverseNameValidation {
  const name = rawName.trim();

  if (name.length === 0) {
    return {
      isValid: false,
      issue: { field: UNIVERSE_NAME_FIELD, code: UNIVERSE_NAME_REQUIRED_CODE },
    };
  }

  if (countCharacters(name) > MAXIMUM_UNIVERSE_NAME_LENGTH) {
    return {
      isValid: false,
      issue: {
        field: UNIVERSE_NAME_FIELD,
        code: UNIVERSE_NAME_TOO_LONG_CODE,
        maximumLength: MAXIMUM_UNIVERSE_NAME_LENGTH,
      },
    };
  }

  return { isValid: true, name };
}

/**
 * Name used to decide whether two universe names are "the same": letter case, accents
 * and surrounding or repeated whitespace are ignored.
 */
export function toComparableUniverseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, " ");
}
