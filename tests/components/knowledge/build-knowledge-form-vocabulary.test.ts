import { describe, expect, it } from "vitest";
import { buildKnowledgeFormVocabulary } from "@/components/knowledge/build-knowledge-form-vocabulary";
import { validateEntityName } from "@/modules/knowledge/domain/entity-name";
import { parseEntityType } from "@/modules/knowledge/domain/entity-type";
import { readFragmentContent } from "@/modules/knowledge/domain/fragment-content";
import { parseKnowledgeItemId } from "@/modules/knowledge/domain/knowledge-item-id";
import { KNOWLEDGE_STATUSES } from "@/modules/knowledge/domain/knowledge-status";
import { parseUnitNumber } from "@/modules/knowledge/domain/unit-number";
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

describe("buildKnowledgeFormVocabulary: the entity form", () => {
  const { entity } = buildKnowledgeFormVocabulary();

  it("carries the field and code the domain reports for every refusal of the name", () => {
    expect(readIssue(validateEntityName("  "))).toEqual({ field: entity.fieldNames.name, code: entity.issueCodes.nameRequired });
    expect(readIssue(validateEntityName("a".repeat(entity.maximumNameLength + 1)))).toEqual({
      field: entity.fieldNames.name,
      code: entity.issueCodes.nameTooLong,
    });
    expect(readIssue(validateEntityName(`bad${NULL_CHARACTER}`))).toEqual({
      field: entity.fieldNames.name,
      code: entity.issueCodes.nameInvalidCharacters,
    });
    expect(validateEntityName("a".repeat(entity.maximumNameLength)).isValid).toBe(true);
  });

  it("carries the codes the domain reports for a malformed work and unit number of a point", () => {
    expect(readIssue(parseKnowledgeItemId("not-an-id", entity.fieldNames.boundaryWorkId))).toEqual({
      field: entity.fieldNames.boundaryWorkId,
      code: entity.issueCodes.workIdInvalid,
    });
    expect(readIssue(parseUnitNumber(" ", entity.fieldNames.boundaryUnitNumber))).toEqual({
      field: entity.fieldNames.boundaryUnitNumber,
      code: entity.issueCodes.unitNumberRequired,
    });
    expect(readIssue(parseUnitNumber("1e3", entity.fieldNames.boundaryUnitNumber))).toEqual({
      field: entity.fieldNames.boundaryUnitNumber,
      code: entity.issueCodes.unitNumberInvalid,
    });
  });

  it("carries the field and code the domain reports for every refusal of the fragment content", () => {
    expect(readFragmentContent("a".repeat(entity.maximumFragmentContentLength + 1))).toMatchObject({
      isValid: false,
      issue: { field: entity.fieldNames.fragmentContent, code: entity.issueCodes.contentTooLong },
    });
    expect(readFragmentContent(`bad${NULL_CHARACTER}`)).toMatchObject({
      isValid: false,
      issue: { field: entity.fieldNames.fragmentContent, code: entity.issueCodes.contentInvalidCharacters },
    });
    expect(readFragmentContent("a".repeat(entity.maximumFragmentContentLength))).toMatchObject({ isValid: true });
  });

  it("names the fields with the input paths the entity action reports (D17)", () => {
    expect(entity.fieldNames).toEqual({
      name: "name",
      type: "type",
      boundaryWorkId: "boundary.workId",
      boundaryUnitNumber: "boundary.unitNumber",
      fragmentContent: "fragment.content",
      fragmentStatus: "fragment.status",
      fragmentBoundaryWorkId: "fragment.boundary.workId",
      fragmentBoundaryUnitNumber: "fragment.boundary.unitNumber",
    });
  });

  it("has the codes of the ten issues, all different", () => {
    const codes = Object.values(entity.issueCodes);

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });

  it("lists the three statuses the domain accepts, in its order", () => {
    expect(entity.statuses).toEqual([...KNOWLEDGE_STATUSES]);
  });
});
