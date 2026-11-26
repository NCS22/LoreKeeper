import { describe, expect, it } from "vitest";
import { buildKnowledgeFormVocabulary } from "@/components/knowledge/build-knowledge-form-vocabulary";
import { getEntityIssueMessage, getWorkIssueMessage } from "@/components/knowledge/knowledge-issue-messages";
import { en } from "@/messages/en";

const vocabulary = buildKnowledgeFormVocabulary();
const codes = vocabulary.work.issueCodes;
const messages = en.workCreation.issues;

describe("getWorkIssueMessage", () => {
  it.each([
    ["a missing title", codes.titleRequired, messages.TITLE_REQUIRED],
    ["a title with characters that cannot be stored", codes.titleInvalidCharacters, messages.TITLE_INVALID_CHARACTERS],
    ["an unknown medium", codes.mediumInvalid, messages.MEDIUM_INVALID],
    ["a missing number of units", codes.unitCountRequired, messages.UNIT_COUNT_REQUIRED],
    ["a number of units that is not only digits", codes.unitCountInvalid, messages.UNIT_COUNT_INVALID],
  ])("maps %s to its own message", (_description, code, expectedMessage) => {
    expect(getWorkIssueMessage({ code }, vocabulary)).toBe(expectedMessage);
  });

  it("states the limit carried by the issue for a title that is too long", () => {
    expect(getWorkIssueMessage({ code: codes.titleTooLong, maximumLength: 37 }, vocabulary)).toBe(messages.TITLE_TOO_LONG(37));
  });

  it("states the limit of the module for a title that is too long when the issue carries none", () => {
    expect(getWorkIssueMessage({ code: codes.titleTooLong }, vocabulary)).toBe(
      messages.TITLE_TOO_LONG(vocabulary.work.maximumTitleLength),
    );
  });

  it("states the maximum number of units of the module for a number out of range", () => {
    expect(getWorkIssueMessage({ code: codes.unitCountOutOfRange }, vocabulary)).toBe(
      messages.UNIT_COUNT_OUT_OF_RANGE(vocabulary.work.maximumUnitCount),
    );
    expect(messages.UNIT_COUNT_OUT_OF_RANGE(vocabulary.work.maximumUnitCount)).toContain("5000");
  });

  it("gives every known issue a different message", () => {
    const shownMessages = Object.values(codes).map((code) => getWorkIssueMessage({ code, maximumLength: 200 }, vocabulary));

    expect(new Set(shownMessages).size).toBe(Object.values(codes).length);
    expect(shownMessages).not.toContain(messages.UNKNOWN);
  });

  it("gives an issue code it does not know the generic message", () => {
    expect(getWorkIssueMessage({ code: "SOMETHING_ELSE" }, vocabulary)).toBe(messages.UNKNOWN);
  });
});

describe("getEntityIssueMessage", () => {
  const entityCodes = vocabulary.entity.issueCodes;
  const entityMessages = en.entityCreation.issues;

  it.each([
    ["a missing name", entityCodes.nameRequired, entityMessages.NAME_REQUIRED],
    ["a name with characters that cannot be stored", entityCodes.nameInvalidCharacters, entityMessages.NAME_INVALID_CHARACTERS],
    ["an unknown type", entityCodes.typeInvalid, entityMessages.TYPE_INVALID],
    ["a malformed work", entityCodes.workIdInvalid, entityMessages.WORK_INVALID],
    ["a missing unit number", entityCodes.unitNumberRequired, entityMessages.UNIT_NUMBER_REQUIRED],
    ["a unit number that is not only digits", entityCodes.unitNumberInvalid, entityMessages.UNIT_NUMBER_INVALID],
    ["a fragment with characters that cannot be stored", entityCodes.contentInvalidCharacters, entityMessages.CONTENT_INVALID_CHARACTERS],
    ["a missing or unknown status", entityCodes.statusInvalid, entityMessages.STATUS_INVALID],
  ])("maps %s to its own message", (_description, code, expectedMessage) => {
    expect(getEntityIssueMessage({ code }, vocabulary)).toBe(expectedMessage);
  });

  it("states the limit carried by the issue, or else the limit of the module, for a name that is too long", () => {
    expect(getEntityIssueMessage({ code: entityCodes.nameTooLong, maximumLength: 37 }, vocabulary)).toBe(
      entityMessages.NAME_TOO_LONG(37),
    );
    expect(getEntityIssueMessage({ code: entityCodes.nameTooLong }, vocabulary)).toBe(
      entityMessages.NAME_TOO_LONG(vocabulary.entity.maximumNameLength),
    );
  });

  it("states the limit carried by the issue, or else the limit of the module, for a fragment that is too long", () => {
    expect(getEntityIssueMessage({ code: entityCodes.contentTooLong, maximumLength: 12 }, vocabulary)).toBe(
      entityMessages.CONTENT_TOO_LONG(12),
    );
    expect(getEntityIssueMessage({ code: entityCodes.contentTooLong }, vocabulary)).toBe(
      entityMessages.CONTENT_TOO_LONG(vocabulary.entity.maximumFragmentContentLength),
    );
  });

  it("gives every known issue a different message", () => {
    const shownMessages = Object.values(entityCodes).map((code) =>
      getEntityIssueMessage({ code, maximumLength: 120 }, vocabulary),
    );

    expect(new Set(shownMessages).size).toBe(Object.values(entityCodes).length);
    expect(shownMessages).not.toContain(entityMessages.UNKNOWN);
  });

  it("gives an issue code it does not know the generic message", () => {
    expect(getEntityIssueMessage({ code: "SOMETHING_ELSE" }, vocabulary)).toBe(entityMessages.UNKNOWN);
  });
});
