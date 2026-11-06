import type { ValidationIssue } from "@/shared/domain/validation-error";

export const MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH = 2000;

export const UNIVERSE_DESCRIPTION_FIELD = "description";
export const UNIVERSE_DESCRIPTION_TOO_LONG_CODE = "DESCRIPTION_TOO_LONG";

export type UniverseDescriptionValidation =
  | { readonly isValid: true; readonly description: string | null }
  | { readonly isValid: false; readonly issue: ValidationIssue };

/** Characters are counted as Unicode code points, so an emoji counts as one. */
function countCharacters(text: string): number {
  return Array.from(text).length;
}

/**
 * Applies the description rules: it is optional, surrounding whitespace is removed, a
 * description left empty becomes "no description" (`null`), line breaks inside are kept
 * and the length, counted after trimming, must not exceed the maximum.
 */
export function validateUniverseDescription(
  rawDescription: string | null,
): UniverseDescriptionValidation {
  const description = rawDescription?.trim() ?? "";

  if (description.length === 0) {
    return { isValid: true, description: null };
  }

  if (countCharacters(description) > MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH) {
    return {
      isValid: false,
      issue: {
        field: UNIVERSE_DESCRIPTION_FIELD,
        code: UNIVERSE_DESCRIPTION_TOO_LONG_CODE,
        maximumLength: MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH,
      },
    };
  }

  return { isValid: true, description };
}
