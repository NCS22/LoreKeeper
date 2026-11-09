import { describe, expect, it } from "vitest";
import {
  collectAccountFieldMessages,
  getAccountIssueMessage,
  type AccountFormFieldName,
  type AccountFormVocabulary,
} from "@/components/accounts/account-issue-messages";
import { buildAccountFormVocabulary } from "@/components/accounts/build-account-form-vocabulary";
import { en } from "@/messages/en";
import * as accountsModule from "@/modules/accounts";

const vocabulary = buildAccountFormVocabulary();
const UNKNOWN_MESSAGE = en.accountForms.issues.unknown;

// Every stable issue code the accounts module publishes. Reading the exports (instead of a list
// written here) makes a code added later to the module fail this test until it has a message.
const PUBLISHED_ISSUE_CODES = Object.entries(accountsModule)
  .filter(([exportName]) => exportName.endsWith("_CODE"))
  .map(([, code]) => String(code));

describe("getAccountIssueMessage", () => {
  it("finds the published issue codes to cover (guards the test itself)", () => {
    expect(PUBLISHED_ISSUE_CODES.length).toBeGreaterThanOrEqual(8);
  });

  it.each(PUBLISHED_ISSUE_CODES)("has a message of its own for the code %s", (code) => {
    const message = getAccountIssueMessage(
      { code, minimumLength: 3, maximumLength: 9 },
      vocabulary,
    );

    expect(message).not.toBe("");
    expect(message).not.toBe(UNKNOWN_MESSAGE);
  });

  it("gives every published code a different message", () => {
    const messages = PUBLISHED_ISSUE_CODES.map((code) =>
      getAccountIssueMessage({ code, minimumLength: 3, maximumLength: 9 }, vocabulary),
    );

    expect(new Set(messages).size).toBe(messages.length);
  });

  it("gives the plain not-valid message to a code it does not know", () => {
    expect(getAccountIssueMessage({ code: "SOMETHING_NEW" }, vocabulary)).toBe(UNKNOWN_MESSAGE);
  });

  describe("limits", () => {
    it("states the maximum of the display name that the issue carries", () => {
      const small = getAccountIssueMessage(
        { code: vocabulary.issueCodes.displayNameTooLong, maximumLength: 7 },
        vocabulary,
      );
      const large = getAccountIssueMessage(
        { code: vocabulary.issueCodes.displayNameTooLong, maximumLength: 4242 },
        vocabulary,
      );

      expect(small).toContain("7");
      expect(small).not.toContain("4242");
      expect(large).toContain("4242");
      expect(large).not.toContain("7");
    });

    it("states the minimum and the maximum of the password that the issue carries", () => {
      const message = getAccountIssueMessage(
        { code: vocabulary.issueCodes.passwordLengthOutOfRange, minimumLength: 11, maximumLength: 313 },
        vocabulary,
      );

      expect(message).toContain("11");
      expect(message).toContain("313");
    });

    it.each([
      ["a display name issue with no maximum", { code: vocabulary.issueCodes.displayNameTooLong }],
      [
        "a password issue with no minimum",
        { code: vocabulary.issueCodes.passwordLengthOutOfRange, maximumLength: 9 },
      ],
      [
        "a password issue with no maximum",
        { code: vocabulary.issueCodes.passwordLengthOutOfRange, minimumLength: 3 },
      ],
    ])("never invents a limit: %s gets the plain not-valid message", (_label, issue) => {
      expect(getAccountIssueMessage(issue, vocabulary)).toBe(UNKNOWN_MESSAGE);
    });

    it("takes the limits from the module's own numbers when the real rules report them", () => {
      expect(accountsModule.MAXIMUM_ACCOUNT_DISPLAY_NAME_LENGTH).toBe(120);
      const message = getAccountIssueMessage(
        {
          code: vocabulary.issueCodes.displayNameTooLong,
          maximumLength: accountsModule.MAXIMUM_ACCOUNT_DISPLAY_NAME_LENGTH,
        },
        vocabulary,
      );

      expect(message).toContain("120");
    });
  });

  it("uses the codes the vocabulary gives, not codes written in the interface", () => {
    const renamedVocabulary: AccountFormVocabulary = {
      ...vocabulary,
      issueCodes: { ...vocabulary.issueCodes, emailInvalid: "A_RENAMED_CODE" },
    };

    expect(getAccountIssueMessage({ code: "A_RENAMED_CODE" }, renamedVocabulary)).toBe(
      en.accountForms.issues.emailInvalid,
    );
    expect(getAccountIssueMessage({ code: vocabulary.issueCodes.emailInvalid }, renamedVocabulary)).toBe(
      UNKNOWN_MESSAGE,
    );
  });
});

describe("collectAccountFieldMessages", () => {
  const ALL_FIELDS: readonly AccountFormFieldName[] = ["displayName", "email", "password", "repeatPassword"];

  it("puts the messages on the field that each issue names", () => {
    const messagesByField = collectAccountFieldMessages(
      {
        [vocabulary.fieldNames.displayName]: [{ code: vocabulary.issueCodes.displayNameRequired }],
        [vocabulary.fieldNames.repeatPassword]: [{ code: vocabulary.issueCodes.repeatPasswordMismatch }],
      },
      ALL_FIELDS,
      vocabulary,
    );

    expect(messagesByField).toEqual({
      displayName: [en.accountForms.issues.displayNameRequired],
      repeatPassword: [en.accountForms.issues.repeatPasswordMismatch],
    });
  });

  it("keeps every message of a field with several issues, in the order reported", () => {
    const messagesByField = collectAccountFieldMessages(
      {
        [vocabulary.fieldNames.displayName]: [
          { code: vocabulary.issueCodes.displayNameTooLong, maximumLength: 120 },
          { code: vocabulary.issueCodes.displayNameInvalidCharacters },
        ],
      },
      ALL_FIELDS,
      vocabulary,
    );

    expect(messagesByField).toEqual({
      displayName: [
        en.accountForms.issues.displayNameTooLong(120),
        en.accountForms.issues.displayNameInvalidCharacters,
      ],
    });
  });

  it("leaves out fields that are not in the form and fields with no issue", () => {
    const messagesByField = collectAccountFieldMessages(
      {
        [vocabulary.fieldNames.displayName]: [{ code: vocabulary.issueCodes.displayNameRequired }],
        [vocabulary.fieldNames.email]: [],
        request: [{ code: "CROSS_SITE_REQUEST" }],
      },
      ["email", "password"],
      vocabulary,
    );

    expect(messagesByField).toEqual({});
  });
});
