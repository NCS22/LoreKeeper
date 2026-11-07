import type { ValidationIssue } from "@/shared/domain/validation-error";

export const MAXIMUM_ACCOUNT_EMAIL_LENGTH = 254;

export const ACCOUNT_EMAIL_FIELD = "email";
export const ACCOUNT_EMAIL_INVALID_CODE = "EMAIL_INVALID";

// The grammar of the spec's "Valid email" definition, ASCII only:
//   local part: parts separated by single dots, each one made of letters, digits and _ ' + -,
//               the whole local part not ending in an apostrophe;
//   domain:     two or more labels separated by single dots, each one starting with a letter or
//               a digit and continuing with letters, digits or hyphens, the last label having
//               only letters, at least two.
// It is the same set of addresses the authentication engine accepts (NFR-1); a contract scenario
// proves it, so the two cannot drift apart.
const LOCAL_PART_CHARACTER = "[A-Za-z0-9_'+-]";
const LOCAL_PART_LAST_CHARACTER = "[A-Za-z0-9_+-]";
const DOMAIN_LABEL = "[A-Za-z0-9][A-Za-z0-9-]*";
const TOP_LEVEL_LABEL = "[A-Za-z]{2,}";
const VALID_EMAIL_PATTERN = new RegExp(
  `^(?:${LOCAL_PART_CHARACTER}+\\.)*${LOCAL_PART_CHARACTER}*${LOCAL_PART_LAST_CHARACTER}` +
    `@(?:${DOMAIN_LABEL}\\.)+${TOP_LEVEL_LABEL}$`,
);

export type AccountEmailValidation =
  | { readonly isValid: true; readonly email: string }
  | { readonly isValid: false; readonly issue: ValidationIssue };

/** The form in which an email is stored and compared: surrounding whitespace removed, lower-case. */
export function toComparableEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

/**
 * An email is valid when, after removing surrounding whitespace, it is at most 254 characters
 * and follows the address grammar above. The grammar is checked before lower-casing, so a
 * character that only becomes ASCII when lower-cased (for example the Kelvin sign) is rejected.
 * The accepted email is returned in its comparable form.
 */
export function validateAccountEmail(rawEmail: string): AccountEmailValidation {
  const trimmedEmail = rawEmail.trim();
  const isValid =
    trimmedEmail.length <= MAXIMUM_ACCOUNT_EMAIL_LENGTH && VALID_EMAIL_PATTERN.test(trimmedEmail);

  if (!isValid) {
    return {
      isValid: false,
      issue: { field: ACCOUNT_EMAIL_FIELD, code: ACCOUNT_EMAIL_INVALID_CODE },
    };
  }

  return { isValid: true, email: toComparableEmail(trimmedEmail) };
}
