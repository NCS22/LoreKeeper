import { describe, expect, it } from "vitest";
import { getUniverseIssueMessage } from "@/components/universes/universe-issue-messages";
import { en } from "@/messages/en";
import {
  UNIVERSE_DESCRIPTION_FIELD,
  UNIVERSE_DESCRIPTION_TOO_LONG_CODE,
  UNIVERSE_MODE_FIELD,
  UNIVERSE_MODE_INVALID_CODE,
  UNIVERSE_NAME_FIELD,
  UNIVERSE_NAME_REQUIRED_CODE,
  UNIVERSE_NAME_TOO_LONG_CODE,
} from "@/modules/universes";

describe("getUniverseIssueMessage", () => {
  it.each([
    ["a missing name", { field: UNIVERSE_NAME_FIELD, code: UNIVERSE_NAME_REQUIRED_CODE }],
    ["an invalid mode", { field: UNIVERSE_MODE_FIELD, code: UNIVERSE_MODE_INVALID_CODE }],
  ])("maps %s to its own message", (_description, issue) => {
    const message = getUniverseIssueMessage(issue);

    expect(message).not.toBe("");
    expect(message).not.toBe(en.universeCreation.issues.UNKNOWN);
  });

  it.each([
    ["a name that is too long", UNIVERSE_NAME_FIELD, UNIVERSE_NAME_TOO_LONG_CODE],
    ["a description that is too long", UNIVERSE_DESCRIPTION_FIELD, UNIVERSE_DESCRIPTION_TOO_LONG_CODE],
  ])("states the limit of the issue for %s, not a limit written in the UI", (_description, field, code) => {
    const messageForSmallLimit = getUniverseIssueMessage({ field, code, maximumLength: 7 });
    const messageForLargeLimit = getUniverseIssueMessage({ field, code, maximumLength: 4242 });

    expect(messageForSmallLimit).toContain("7");
    expect(messageForSmallLimit).not.toContain("4242");
    expect(messageForLargeLimit).toContain("4242");
    expect(messageForLargeLimit).not.toContain("7");
  });

  it("gives name and description different messages for the same kind of failure", () => {
    const nameMessage = getUniverseIssueMessage({
      field: UNIVERSE_NAME_FIELD,
      code: UNIVERSE_NAME_TOO_LONG_CODE,
      maximumLength: 10,
    });
    const descriptionMessage = getUniverseIssueMessage({
      field: UNIVERSE_DESCRIPTION_FIELD,
      code: UNIVERSE_DESCRIPTION_TOO_LONG_CODE,
      maximumLength: 10,
    });

    expect(nameMessage).not.toBe(descriptionMessage);
  });

  it("fails loudly when a length issue carries no limit, instead of showing a made-up number", () => {
    expect(() =>
      getUniverseIssueMessage({ field: UNIVERSE_NAME_FIELD, code: UNIVERSE_NAME_TOO_LONG_CODE }),
    ).toThrow();
  });

  it("falls back to a generic message for a code it does not know", () => {
    expect(getUniverseIssueMessage({ field: "name", code: "SOMETHING_NEW" })).toBe(
      en.universeCreation.issues.UNKNOWN,
    );
  });
});
