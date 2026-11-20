import { describe, expect, it } from "vitest";
import { buildUniverseFormVocabulary } from "@/components/universes/build-universe-form-vocabulary";
import { validateUniverseDescription } from "@/modules/universes/domain/universe-description";
import { validateUniverseName } from "@/modules/universes/domain/universe-name";
import { parseUniverseMode } from "@/modules/universes/domain/universe-mode";

const NULL_CHARACTER = String.fromCharCode(0);

/** The code of the one issue a text produces; fails the test when it produces none. */
function readIssueCode(
  validation: { isValid: true } | { isValid: false; issue: { code: string } },
): string {
  if (validation.isValid) {
    throw new Error("Expected the text to be refused.");
  }
  return validation.issue.code;
}

describe("buildUniverseFormVocabulary", () => {
  const vocabulary = buildUniverseFormVocabulary();

  it("names the three form fields as the issues of the module do", () => {
    expect(vocabulary.fieldNames).toEqual({ name: "name", description: "description", mode: "mode" });
  });

  it("carries the code the domain reports for every refusal of the name", () => {
    expect(readIssueCode(validateUniverseName("   "))).toBe(vocabulary.issueCodes.nameRequired);
    expect(readIssueCode(validateUniverseName("a".repeat(121)))).toBe(vocabulary.issueCodes.nameTooLong);
    expect(readIssueCode(validateUniverseName(`bad${NULL_CHARACTER}`))).toBe(
      vocabulary.issueCodes.nameInvalidCharacters,
    );
  });

  it("carries the code the domain reports for every refusal of the description", () => {
    expect(readIssueCode(validateUniverseDescription("a".repeat(2001)))).toBe(
      vocabulary.issueCodes.descriptionTooLong,
    );
    expect(readIssueCode(validateUniverseDescription(`bad${NULL_CHARACTER}`))).toBe(
      vocabulary.issueCodes.descriptionInvalidCharacters,
    );
  });

  it("has the codes of the six issues, all different", () => {
    const codes = Object.values(vocabulary.issueCodes);

    expect(codes).toHaveLength(6);
    expect(new Set(codes).size).toBe(6);
  });

  it("lists the modes the domain accepts, with READER as the default", () => {
    expect(vocabulary.modes).toEqual(["READER", "AUTHOR"]);
    expect(vocabulary.modes.every((mode) => parseUniverseMode(mode) !== null)).toBe(true);
    expect(vocabulary.defaultMode).toBe("READER");
  });
});
