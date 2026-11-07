// Public interface of the accounts module. Nothing outside the module imports anything else.
export { createAccountsModule } from "./composition";
export type { AccountsModule } from "./composition";
export type { SignUpCommand, SignUpResult } from "./application/sign-up";
export type { SignInCommand, SignInResult } from "./application/sign-in";

// Field names and stable issue codes, so a consumer can choose its own text by field and code.
export {
  ACCOUNT_DISPLAY_NAME_FIELD,
  ACCOUNT_DISPLAY_NAME_INVALID_CHARACTERS_CODE,
  ACCOUNT_DISPLAY_NAME_REQUIRED_CODE,
  ACCOUNT_DISPLAY_NAME_TOO_LONG_CODE,
} from "./domain/account-display-name";
export { ACCOUNT_EMAIL_FIELD, ACCOUNT_EMAIL_INVALID_CODE } from "./domain/account-email";
export { ACCOUNT_PASSWORD_FIELD, ACCOUNT_PASSWORD_LENGTH_CODE } from "./domain/account-password";
export { REPEAT_PASSWORD_FIELD, REPEAT_PASSWORD_MISMATCH_CODE } from "./domain/new-account";
export {
  SIGN_IN_EMAIL_REQUIRED_CODE,
  SIGN_IN_PASSWORD_REQUIRED_CODE,
} from "./domain/sign-in-credentials";

// Length limits, so no consumer repeats the numbers.
export { MAXIMUM_ACCOUNT_DISPLAY_NAME_LENGTH } from "./domain/account-display-name";
export { MAXIMUM_ACCOUNT_EMAIL_LENGTH } from "./domain/account-email";
export {
  MAXIMUM_ACCOUNT_PASSWORD_LENGTH,
  MINIMUM_ACCOUNT_PASSWORD_LENGTH,
} from "./domain/account-password";
