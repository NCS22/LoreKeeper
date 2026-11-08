import { en } from "@/messages/en";

// The browser never imports the accounts module (its public interface also exports server-only
// wiring). A server page reads the field names and issue codes from the module and hands them down
// as props in this shape (specs/003-account-screens/plan.md, D13).

/** The fields of the sign-up and sign-in forms, named as the forms keep them. */
export type AccountFormFieldName = "displayName" | "email" | "password" | "repeatPassword";

export type AccountFormVocabulary = {
  /** The name each form field has in the issues the actions return. */
  readonly fieldNames: Readonly<Record<AccountFormFieldName, string>>;
  /** The stable code of each issue the account rules report. */
  readonly issueCodes: {
    readonly displayNameRequired: string;
    readonly displayNameTooLong: string;
    readonly displayNameInvalidCharacters: string;
    readonly emailInvalid: string;
    readonly emailRequired: string;
    readonly passwordLengthOutOfRange: string;
    readonly passwordRequired: string;
    readonly repeatPasswordMismatch: string;
  };
};

/** One rejected value as the action returns it: the code and, for length rules, the limits. */
export type AccountIssue = {
  readonly code: string;
  readonly minimumLength?: number;
  readonly maximumLength?: number;
};

/** The messages of each field that has errors; a field with several issues has all its messages. */
export type AccountFieldMessages = Partial<Record<AccountFormFieldName, readonly string[]>>;

/**
 * Turns one issue into the text shown under its field. The message is chosen by the stable code and
 * any limit shown comes from the issue itself, never from the interface. An unknown code, or a
 * length issue that carries no limit, gets the plain "not valid" message instead of a wrong number.
 */
export function getAccountIssueMessage(issue: AccountIssue, vocabulary: AccountFormVocabulary): string {
  const messages = en.accountForms.issues;
  const codes = vocabulary.issueCodes;

  switch (issue.code) {
    case codes.displayNameRequired:
      return messages.displayNameRequired;
    case codes.displayNameTooLong:
      return issue.maximumLength === undefined
        ? messages.unknown
        : messages.displayNameTooLong(issue.maximumLength);
    case codes.displayNameInvalidCharacters:
      return messages.displayNameInvalidCharacters;
    case codes.emailInvalid:
      return messages.emailInvalid;
    case codes.emailRequired:
      return messages.emailRequired;
    case codes.passwordLengthOutOfRange:
      return issue.minimumLength === undefined || issue.maximumLength === undefined
        ? messages.unknown
        : messages.passwordLength(issue.minimumLength, issue.maximumLength);
    case codes.passwordRequired:
      return messages.passwordRequired;
    case codes.repeatPasswordMismatch:
      return messages.repeatPasswordMismatch;
    default:
      return messages.unknown;
  }
}

/**
 * Groups the messages of the issues of the given form fields, in the order the action reported
 * them. Issues of any other field (for example a rejected request) are not field errors and are
 * left out. A field with no issue is absent from the result.
 */
export function collectAccountFieldMessages(
  issuesByFieldName: Readonly<Record<string, readonly AccountIssue[]>>,
  formFields: readonly AccountFormFieldName[],
  vocabulary: AccountFormVocabulary,
): AccountFieldMessages {
  const messagesByField: Partial<Record<AccountFormFieldName, readonly string[]>> = {};

  for (const formField of formFields) {
    const issuesOfField = issuesByFieldName[vocabulary.fieldNames[formField]] ?? [];
    if (issuesOfField.length > 0) {
      messagesByField[formField] = issuesOfField.map((issue) =>
        getAccountIssueMessage(issue, vocabulary),
      );
    }
  }

  return messagesByField;
}
