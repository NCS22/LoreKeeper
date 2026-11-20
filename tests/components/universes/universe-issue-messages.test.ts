import { describe, expect, it } from "vitest";
import { buildUniverseFormVocabulary } from "@/components/universes/build-universe-form-vocabulary";
import { getUniverseIssueMessage } from "@/components/universes/universe-issue-messages";
import { en } from "@/messages/en";

const vocabulary = buildUniverseFormVocabulary();
const codes = vocabulary.issueCodes;

describe("getUniverseIssueMessage", () => {
  it.each([
    ["a missing name", codes.nameRequired],
    ["a name with characters that cannot be stored", codes.nameInvalidCharacters],
    ["a description with characters that cannot be stored", codes.descriptionInvalidCharacters],
    ["an invalid mode", codes.modeInvalid],
  ])("maps %s to its own message", (_description, code) => {
    const message = getUniverseIssueMessage({ code }, vocabulary);

    expect(message).not.toBe("");
    expect(message).not.toBe(en.universeCreation.issues.UNKNOWN);
  });

  it.each([
    ["a name that is too long", codes.nameTooLong],
    ["a description that is too long", codes.descriptionTooLong],
  ])("states the limit of the issue for %s, not a limit written in the UI", (_description, code) => {
    const messageForSmallLimit = getUniverseIssueMessage({ code, maximumLength: 7 }, vocabulary);
    const messageForLargeLimit = getUniverseIssueMessage({ code, maximumLength: 4242 }, vocabulary);

    expect(messageForSmallLimit).toContain("7");
    expect(messageForSmallLimit).not.toContain("4242");
    expect(messageForLargeLimit).toContain("4242");
    expect(messageForLargeLimit).not.toContain("7");
  });

  it("has its own message for every issue code the vocabulary exports", () => {
    const limitedCodes: readonly string[] = [codes.nameTooLong, codes.descriptionTooLong];

    for (const code of Object.values(codes)) {
      const issue = limitedCodes.includes(code) ? { code, maximumLength: 5 } : { code };
      expect(getUniverseIssueMessage(issue, vocabulary), code).not.toBe(en.universeCreation.issues.UNKNOWN);
    }
  });

  it("gives name and description different messages for the same kind of failure", () => {
    const nameMessage = getUniverseIssueMessage({ code: codes.nameTooLong, maximumLength: 10 }, vocabulary);
    const descriptionMessage = getUniverseIssueMessage(
      { code: codes.descriptionTooLong, maximumLength: 10 },
      vocabulary,
    );

    expect(nameMessage).not.toBe(descriptionMessage);
  });

  it("fails loudly when a length issue carries no limit, instead of showing a made-up number", () => {
    expect(() => getUniverseIssueMessage({ code: codes.nameTooLong }, vocabulary)).toThrow();
  });

  it("falls back to a generic message for a code it does not know", () => {
    expect(getUniverseIssueMessage({ code: "SOMETHING_NEW" }, vocabulary)).toBe(
      en.universeCreation.issues.UNKNOWN,
    );
  });

  it("reads the codes from the vocabulary it is given, not from constants of its own", () => {
    const otherVocabulary = {
      ...vocabulary,
      issueCodes: { ...codes, nameRequired: "OTHER_NAME_REQUIRED" },
    };

    expect(getUniverseIssueMessage({ code: "OTHER_NAME_REQUIRED" }, otherVocabulary)).toBe(
      en.universeCreation.issues.NAME_REQUIRED,
    );
    expect(getUniverseIssueMessage({ code: codes.nameRequired }, otherVocabulary)).toBe(
      en.universeCreation.issues.UNKNOWN,
    );
  });
});
