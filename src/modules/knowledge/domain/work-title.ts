import { countTextCharacters, isStorableText } from "@/shared/domain/text-rules";
import type { ValidationIssue } from "@/shared/domain/validation-error";

export const MAXIMUM_WORK_TITLE_LENGTH = 200;

export const WORK_TITLE_FIELD = "title";
export const WORK_TITLE_REQUIRED_CODE = "TITLE_REQUIRED";
export const WORK_TITLE_TOO_LONG_CODE = "TITLE_TOO_LONG";
export const WORK_TITLE_INVALID_CHARACTERS_CODE = "TITLE_INVALID_CHARACTERS";

export type WorkTitleValidation =
  | { readonly isValid: true; readonly title: string }
  | { readonly isValid: false; readonly issue: ValidationIssue };

/**
 * Applies the title rules of a work (FR-1): surrounding whitespace is removed, the result must not
 * be empty, must be a storable text and its length in code points must not exceed the maximum.
 * Two works may have the same title.
 */
export function validateWorkTitle(rawTitle: string): WorkTitleValidation {
  const title = rawTitle.trim();

  if (title.length === 0) {
    return { isValid: false, issue: { field: WORK_TITLE_FIELD, code: WORK_TITLE_REQUIRED_CODE } };
  }

  if (!isStorableText(title)) {
    return {
      isValid: false,
      issue: { field: WORK_TITLE_FIELD, code: WORK_TITLE_INVALID_CHARACTERS_CODE },
    };
  }

  if (countTextCharacters(title) > MAXIMUM_WORK_TITLE_LENGTH) {
    return {
      isValid: false,
      issue: {
        field: WORK_TITLE_FIELD,
        code: WORK_TITLE_TOO_LONG_CODE,
        maximumLength: MAXIMUM_WORK_TITLE_LENGTH,
      },
    };
  }

  return { isValid: true, title };
}
