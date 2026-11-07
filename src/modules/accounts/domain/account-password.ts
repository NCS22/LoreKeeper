import type { ValidationIssue } from "@/shared/domain/validation-error";

export const MINIMUM_ACCOUNT_PASSWORD_LENGTH = 8;
export const MAXIMUM_ACCOUNT_PASSWORD_LENGTH = 128;

export const ACCOUNT_PASSWORD_FIELD = "password";
export const ACCOUNT_PASSWORD_LENGTH_CODE = "PASSWORD_LENGTH_OUT_OF_RANGE";

export type AccountPasswordValidation =
  | { readonly isValid: true; readonly password: string }
  | { readonly isValid: false; readonly issue: ValidationIssue };

/** Characters are counted as Unicode code points, so an astral character counts as one. */
function countCharacters(text: string): number {
  return Array.from(text).length;
}

/**
 * A password is valid with 8 to 128 characters. Every character is significant and the value
 * is returned exactly as typed: no trimming, no truncation and no Unicode normalization.
 * There are no composition rules.
 */
export function validateAccountPassword(rawPassword: string): AccountPasswordValidation {
  const length = countCharacters(rawPassword);

  if (length < MINIMUM_ACCOUNT_PASSWORD_LENGTH || length > MAXIMUM_ACCOUNT_PASSWORD_LENGTH) {
    return {
      isValid: false,
      issue: {
        field: ACCOUNT_PASSWORD_FIELD,
        code: ACCOUNT_PASSWORD_LENGTH_CODE,
        minimumLength: MINIMUM_ACCOUNT_PASSWORD_LENGTH,
        maximumLength: MAXIMUM_ACCOUNT_PASSWORD_LENGTH,
      },
    };
  }

  return { isValid: true, password: rawPassword };
}
