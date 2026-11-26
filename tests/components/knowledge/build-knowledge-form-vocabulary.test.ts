import { describe, expect, it } from "vitest";
import { buildKnowledgeFormVocabulary } from "@/components/knowledge/build-knowledge-form-vocabulary";
import { parseEntityType } from "@/modules/knowledge/domain/entity-type";
import { parseUnitCount } from "@/modules/knowledge/domain/unit-count";
import { parseWorkMedium } from "@/modules/knowledge/domain/work-medium";
import { validateWorkTitle } from "@/modules/knowledge/domain/work-title";

const NULL_CHARACTER = String.fromCharCode(0);

/** The code and field of the one issue a value produces; fails the test when it produces none. */
function readIssue(
  validation: { isValid: true } | { isValid: false; issue: { field: string; code: string } },
): { field: string; code: string } {
  if (validation.isValid) {
    throw new Error("Expected the value to be refused.");
  }
  return { field: validation.issue.field, code: validation.issue.code };
}

describe("buildKnowledgeFormVocabulary: the work form", () => {
  const { work } = buildKnowledgeFormVocabulary();

  it("carries the field and code the domain reports for every refusal of the title", () => {
    expect(readIssue(validateWorkTitle("   "))).toEqual({ field: work.fieldNames.title, code: work.issueCodes.titleRequired });
    expect(readIssue(validateWorkTitle("a".repeat(work.maximumTitleLength + 1)))).toEqual({
      field: work.fieldNames.title,
      code: work.issueCodes.titleTooLong,
    });
    expect(readIssue(validateWorkTitle(`bad${NULL_CHARACTER}`))).toEqual({
      field: work.fieldNames.title,
      code: work.issueCodes.titleInvalidCharacters,
    });
    expect(validateWorkTitle("a".repeat(work.maximumTitleLength)).isValid).toBe(true);
  });

  it("carries the field and code the domain reports for every refusal of the number of units", () => {
    expect(readIssue(parseUnitCount(" "))).toEqual({ field: work.fieldNames.unitCount, code: work.issueCodes.unitCountRequired });
    expect(readIssue(parseUnitCount("1e3"))).toEqual({ field: work.fieldNames.unitCount, code: work.issueCodes.unitCountInvalid });
    expect(readIssue(parseUnitCount(String(work.maximumUnitCount + 1)))).toEqual({
      field: work.fieldNames.unitCount,
      code: work.issueCodes.unitCountOutOfRange,
    });
    expect(parseUnitCount(String(work.maximumUnitCount)).isValid).toBe(true);
  });

  it("names the medium field as the issues of the module do", () => {
    expect(work.fieldNames.medium).toBe("medium");
  });

  it("has the codes of the seven issues, all different", () => {
    const codes = Object.values(work.issueCodes);

    expect(codes).toHaveLength(7);
    expect(new Set(codes).size).toBe(7);
  });

  it("lists the seven media the domain accepts, with NOVEL first", () => {
    expect(work.mediums).toEqual(["NOVEL", "MANGA", "COMIC", "ANIME", "TV_SERIES", "FILM", "OTHER"]);
    expect(work.mediums.every((medium) => parseWorkMedium(medium) !== null)).toBe(true);
  });
});

describe("buildKnowledgeFormVocabulary: the entity types", () => {
  it("lists the eight entity types the domain accepts", () => {
    const { entityTypes } = buildKnowledgeFormVocabulary();

    expect(entityTypes).toHaveLength(8);
    expect(entityTypes.every((entityType) => parseEntityType(entityType) !== null)).toBe(true);
  });
});
