import { ValidationError, type ValidationIssue } from "@/shared/domain/validation-error";
import { ACCOUNT_EMAIL_FIELD, toComparableEmail } from "./account-email";
import { ACCOUNT_PASSWORD_FIELD } from "./account-password";

export const SIGN_IN_EMAIL_REQUIRED_CODE = "EMAIL_REQUIRED";
export const SIGN_IN_PASSWORD_REQUIRED_CODE = "PASSWORD_REQUIRED";

/** What the person typed in the sign-in form, untouched. */
export type SignInInput = {
  readonly email: string;
  readonly password: string;
};

/** Credentials to check: comparable email and password exactly as typed. */
export type SignInCredentials = {
  readonly email: string;
  readonly password: string;
};

/**
 * The only failures before the credential check are an email that is empty after trimming and
 * an empty password. Format and length are deliberately not checked, so any other wrong value
 * gets the same answer as an unknown email.
 */
export function parseSignInCredentials(input: SignInInput): SignInCredentials {
  const email = toComparableEmail(input.email);

  const issues: ValidationIssue[] = [];
  if (email.length === 0) {
    issues.push({ field: ACCOUNT_EMAIL_FIELD, code: SIGN_IN_EMAIL_REQUIRED_CODE });
  }
  if (input.password.length === 0) {
    issues.push({ field: ACCOUNT_PASSWORD_FIELD, code: SIGN_IN_PASSWORD_REQUIRED_CODE });
  }

  if (issues.length > 0) {
    throw new ValidationError(issues);
  }

  return { email, password: input.password };
}
