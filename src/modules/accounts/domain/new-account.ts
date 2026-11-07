import { ValidationError, type ValidationIssue } from "@/shared/domain/validation-error";
import { validateAccountDisplayName } from "./account-display-name";
import { validateAccountEmail } from "./account-email";
import { validateAccountPassword } from "./account-password";

export const REPEAT_PASSWORD_FIELD = "repeatPassword";
export const REPEAT_PASSWORD_MISMATCH_CODE = "PASSWORDS_DO_NOT_MATCH";

/** What the person typed in the sign-up form, untouched. */
export type NewAccountInput = {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  readonly repeatPassword: string;
};

/** A sign-up that passed every rule: trimmed display name, comparable email, password as typed. */
export type NewAccount = {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
};

/**
 * Applies the three field rules and the repeat-password match together. When anything fails it
 * throws one `ValidationError` that lists every failing field, in form order.
 */
export function parseNewAccount(input: NewAccountInput): NewAccount {
  const displayNameValidation = validateAccountDisplayName(input.displayName);
  const emailValidation = validateAccountEmail(input.email);
  const passwordValidation = validateAccountPassword(input.password);

  const issues: ValidationIssue[] = [];
  if (!displayNameValidation.isValid) issues.push(displayNameValidation.issue);
  if (!emailValidation.isValid) issues.push(emailValidation.issue);
  if (!passwordValidation.isValid) issues.push(passwordValidation.issue);
  if (input.repeatPassword !== input.password) {
    issues.push({ field: REPEAT_PASSWORD_FIELD, code: REPEAT_PASSWORD_MISMATCH_CODE });
  }

  if (
    issues.length > 0 ||
    !displayNameValidation.isValid ||
    !emailValidation.isValid ||
    !passwordValidation.isValid
  ) {
    throw new ValidationError(issues);
  }

  return {
    displayName: displayNameValidation.displayName,
    email: emailValidation.email,
    password: passwordValidation.password,
  };
}
