import type { ValidationIssue } from "@/shared/domain/validation-error";
import { countUniverseTextCharacters, isValidUniverseText } from "./universe-text";

export const MAXIMUM_UNIVERSE_NAME_LENGTH = 120;

export const UNIVERSE_NAME_FIELD = "name";
export const UNIVERSE_NAME_REQUIRED_CODE = "NAME_REQUIRED";
export const UNIVERSE_NAME_TOO_LONG_CODE = "NAME_TOO_LONG";
export const UNIVERSE_NAME_INVALID_CHARACTERS_CODE = "NAME_INVALID_CHARACTERS";

export type UniverseNameValidation =
  | { readonly isValid: true; readonly name: string }
  | { readonly isValid: false; readonly issue: ValidationIssue };

/**
 * Applies the name rules: surrounding whitespace is removed, the result must not be
 * empty, must be a storable text and its length in code points, counted after trimming,
 * must not exceed the maximum.
 */
export function validateUniverseName(rawName: string): UniverseNameValidation {
  const name = rawName.trim();

  if (name.length === 0) {
    return {
      isValid: false,
      issue: { field: UNIVERSE_NAME_FIELD, code: UNIVERSE_NAME_REQUIRED_CODE },
    };
  }

  if (!isValidUniverseText(name)) {
    return {
      isValid: false,
      issue: { field: UNIVERSE_NAME_FIELD, code: UNIVERSE_NAME_INVALID_CHARACTERS_CODE },
    };
  }

  if (countUniverseTextCharacters(name) > MAXIMUM_UNIVERSE_NAME_LENGTH) {
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
 * Name used to decide whether two universe names are "the same": letter case, accents,
 * surrounding or repeated whitespace and the composed or decomposed form of a character
 * are ignored.
 */
export function toComparableUniverseName(name: string): string {
  return name
    .normalize("NFC")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, " ");
}
