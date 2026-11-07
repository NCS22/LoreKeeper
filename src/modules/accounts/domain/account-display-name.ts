import type { ValidationIssue } from "@/shared/domain/validation-error";

export const MAXIMUM_ACCOUNT_DISPLAY_NAME_LENGTH = 120;

export const ACCOUNT_DISPLAY_NAME_FIELD = "displayName";
export const ACCOUNT_DISPLAY_NAME_REQUIRED_CODE = "DISPLAY_NAME_REQUIRED";
export const ACCOUNT_DISPLAY_NAME_INVALID_CHARACTERS_CODE = "DISPLAY_NAME_INVALID_CHARACTERS";
export const ACCOUNT_DISPLAY_NAME_TOO_LONG_CODE = "DISPLAY_NAME_TOO_LONG";

// Control characters (tab, line break...) plus the Unicode line and paragraph separators.
const FORBIDDEN_CHARACTER_PATTERN = /[\p{Cc}\p{Zl}\p{Zp}]/u;

export type AccountDisplayNameValidation =
  | { readonly isValid: true; readonly displayName: string }
  | { readonly isValid: false; readonly issue: ValidationIssue };

/** Characters are counted as Unicode code points, so an emoji counts as one. */
function countCharacters(text: string): number {
  return Array.from(text).length;
}

function rejectDisplayName(issue: Omit<ValidationIssue, "field">): AccountDisplayNameValidation {
  return { isValid: false, issue: { field: ACCOUNT_DISPLAY_NAME_FIELD, ...issue } };
}

/**
 * Applies the display-name rules, in this order of precedence: it must not be empty or
 * whitespace-only, then it must have no control characters, then its trimmed length must
 * not exceed the maximum. Control characters are looked for in the raw value, before
 * trimming, so a trailing line break is rejected and not silently removed. Inner whitespace
 * is kept as typed.
 */
export function validateAccountDisplayName(rawDisplayName: string): AccountDisplayNameValidation {
  const displayName = rawDisplayName.trim();

  if (displayName.length === 0) {
    return rejectDisplayName({ code: ACCOUNT_DISPLAY_NAME_REQUIRED_CODE });
  }

  if (FORBIDDEN_CHARACTER_PATTERN.test(rawDisplayName)) {
    return rejectDisplayName({ code: ACCOUNT_DISPLAY_NAME_INVALID_CHARACTERS_CODE });
  }

  if (countCharacters(displayName) > MAXIMUM_ACCOUNT_DISPLAY_NAME_LENGTH) {
    return rejectDisplayName({
      code: ACCOUNT_DISPLAY_NAME_TOO_LONG_CODE,
      maximumLength: MAXIMUM_ACCOUNT_DISPLAY_NAME_LENGTH,
    });
  }

  return { isValid: true, displayName };
}
