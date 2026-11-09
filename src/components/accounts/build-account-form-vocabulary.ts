import {
  ACCOUNT_DISPLAY_NAME_FIELD,
  ACCOUNT_DISPLAY_NAME_INVALID_CHARACTERS_CODE,
  ACCOUNT_DISPLAY_NAME_REQUIRED_CODE,
  ACCOUNT_DISPLAY_NAME_TOO_LONG_CODE,
  ACCOUNT_EMAIL_FIELD,
  ACCOUNT_EMAIL_INVALID_CODE,
  ACCOUNT_PASSWORD_FIELD,
  ACCOUNT_PASSWORD_LENGTH_CODE,
  REPEAT_PASSWORD_FIELD,
  REPEAT_PASSWORD_MISMATCH_CODE,
  SIGN_IN_EMAIL_REQUIRED_CODE,
  SIGN_IN_PASSWORD_REQUIRED_CODE,
} from "@/modules/accounts";
import type { AccountFormVocabulary } from "@/components/accounts/account-issue-messages";

/**
 * SERVER ONLY. Reads the field names and issue codes of the accounts module, to be passed as a
 * prop to the sign-up and sign-in forms. A client component must never import this file: the
 * accounts module also exports server-only wiring, and the production build fails if it does.
 */
export function buildAccountFormVocabulary(): AccountFormVocabulary {
  return {
    fieldNames: {
      displayName: ACCOUNT_DISPLAY_NAME_FIELD,
      email: ACCOUNT_EMAIL_FIELD,
      password: ACCOUNT_PASSWORD_FIELD,
      repeatPassword: REPEAT_PASSWORD_FIELD,
    },
    issueCodes: {
      displayNameRequired: ACCOUNT_DISPLAY_NAME_REQUIRED_CODE,
      displayNameTooLong: ACCOUNT_DISPLAY_NAME_TOO_LONG_CODE,
      displayNameInvalidCharacters: ACCOUNT_DISPLAY_NAME_INVALID_CHARACTERS_CODE,
      emailInvalid: ACCOUNT_EMAIL_INVALID_CODE,
      emailRequired: SIGN_IN_EMAIL_REQUIRED_CODE,
      passwordLengthOutOfRange: ACCOUNT_PASSWORD_LENGTH_CODE,
      passwordRequired: SIGN_IN_PASSWORD_REQUIRED_CODE,
      repeatPasswordMismatch: REPEAT_PASSWORD_MISMATCH_CODE,
    },
  };
}
