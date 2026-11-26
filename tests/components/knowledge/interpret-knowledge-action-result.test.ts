import { describe, expect, it } from "vitest";
import type { TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";
import { buildKnowledgeFormVocabulary } from "@/components/knowledge/build-knowledge-form-vocabulary";
import {
  interpretCreateWorkResult,
  interpretLoadUniverseKnowledgeResult,
} from "@/components/knowledge/interpret-knowledge-action-result";
import { en } from "@/messages/en";
import {
  SESSION_CHECK_FAILED_ACTION_REFUSAL,
  SIGNED_OUT_ACTION_REFUSAL,
} from "@/shared/presentation/signed-out-action-response";

const vocabulary = buildKnowledgeFormVocabulary();
const { fieldNames, issueCodes } = vocabulary.work;

const STORED_WORK = {
  id: "6c1e8a0f-2b3d-4c5e-9f7a-1b2c3d4e5f60",
  title: "The Fellowship",
  medium: "NOVEL",
  unitWording: "chapter",
  unitCount: 120,
  createdAt: "2026-11-26T10:00:00.000Z",
};

const STORED_ENTITY = {
  id: "7d2f9b1a-3c4e-4d6f-8a9b-2c3d4e5f6a71",
  name: "Frodo",
  type: "CHARACTER",
  createdAt: "2026-11-26T10:05:00.000Z",
};

const STORED_RELATIONSHIP_TYPE = {
  id: "8e3a0c2b-4d5f-4e7a-9b0c-3d4e5f6a7b82",
  key: "ALLY_OF",
  label: "ally of",
  inverseLabel: "ally of",
  isSymmetric: true,
};

const LOADED_KNOWLEDGE = {
  works: [STORED_WORK],
  entities: [STORED_ENTITY],
  relationshipTypes: [STORED_RELATIONSHIP_TYPE],
};

const TIMED_OUT: TimeLimitedOutcome<unknown> = { status: "timed-out" };

function answered(value: unknown): TimeLimitedOutcome<unknown> {
  return { status: "answered", value };
}

function rejected(error: unknown): TimeLimitedOutcome<unknown> {
  return { status: "rejected", error };
}

function failure(code: string, fieldErrors?: unknown): TimeLimitedOutcome<unknown> {
  return answered({ ok: false, error: { code, message: "A message.", fieldErrors } });
}

describe("interpretCreateWorkResult", () => {
  it("reads a stored work as created", () => {
    expect(interpretCreateWorkResult(answered({ ok: true, value: { work: STORED_WORK } }), vocabulary)).toEqual({
      status: "created",
      work: STORED_WORK,
    });
  });

  it.each([
    ["no work in the value", { ok: true, value: {} }],
    ["a work without an identifier", { ok: true, value: { work: { ...STORED_WORK, id: 7 } } }],
    ["a work with an unknown medium", { ok: true, value: { work: { ...STORED_WORK, medium: "OPERA" } } }],
    ["a work without its unit wording", { ok: true, value: { work: { ...STORED_WORK, unitWording: undefined } } }],
    ["a work whose number of units is not a whole number", { ok: true, value: { work: { ...STORED_WORK, unitCount: 1.5 } } }],
    ["a body that is not an object", "ok"],
    ["a failure without its error", { ok: false }],
  ])("reads %s as a generic failure", (_description, body) => {
    expect(interpretCreateWorkResult(answered(body), vocabulary)).toEqual({ status: "generic-failure" });
  });

  it("gives each rejected field of the form its own message, the first issue of each, and ignores fields it does not know", () => {
    const outcome = interpretCreateWorkResult(
      failure("VALIDATION_ERROR", {
        [fieldNames.title]: [{ code: issueCodes.titleTooLong, maximumLength: 200 }],
        [fieldNames.medium]: [{ code: issueCodes.mediumInvalid }],
        [fieldNames.unitCount]: [{ code: issueCodes.unitCountInvalid }, { code: issueCodes.unitCountRequired }],
        ownerId: [{ code: "SOMETHING" }],
      }),
      vocabulary,
    );

    expect(outcome).toEqual({
      status: "field-errors",
      messagesByField: {
        title: en.workCreation.issues.TITLE_TOO_LONG(200),
        medium: en.workCreation.issues.MEDIUM_INVALID,
        unitCount: en.workCreation.issues.UNIT_COUNT_INVALID,
      },
    });
  });

  it.each([
    ["only issues of fields that are not in the form, such as a malformed universe", { universeId: [{ code: "ID_INVALID" }] }],
    ["field errors that are not an object", "title"],
    ["issues without a code", { title: [{ maximumLength: 200 }] }],
  ])("reads a validation failure with %s as a generic failure", (_description, fieldErrors) => {
    expect(interpretCreateWorkResult(failure("VALIDATION_ERROR", fieldErrors), vocabulary)).toEqual({
      status: "generic-failure",
    });
  });

  it.each([
    ["a universe that is not found", failure("NOT_FOUND")],
    ["a storage failure", failure("INFRASTRUCTURE_ERROR")],
    ["an unverifiable session", rejected(new Error(SESSION_CHECK_FAILED_ACTION_REFUSAL.text))],
  ])("reads %s as a generic failure, with nothing stored", (_description, end) => {
    expect(interpretCreateWorkResult(end, vocabulary)).toEqual({ status: "generic-failure" });
  });

  it.each([
    ["the authentication error", failure("AUTHENTICATION_ERROR")],
    ["the signed-out refusal of the guard", rejected(new Error(SIGNED_OUT_ACTION_REFUSAL.text))],
  ])("asks the person to sign in again on %s", (_description, end) => {
    expect(interpretCreateWorkResult(end, vocabulary)).toEqual({ status: "sign-in-again" });
  });

  it.each([
    ["no answer in time", TIMED_OUT],
    ["a lost connection", rejected(new TypeError("Failed to fetch"))],
  ])("reads %s as an unknown result: the work may exist", (_description, end) => {
    expect(interpretCreateWorkResult(end, vocabulary)).toEqual({ status: "result-unknown" });
  });
});

describe("interpretLoadUniverseKnowledgeResult", () => {
  it("reads the works, entities and relationship types of the universe", () => {
    expect(interpretLoadUniverseKnowledgeResult(answered({ ok: true, value: LOADED_KNOWLEDGE }), vocabulary)).toEqual({
      status: "loaded",
      knowledge: LOADED_KNOWLEDGE,
    });
  });

  it("reads a universe with nothing in it as loaded and empty", () => {
    const emptyKnowledge = { works: [], entities: [], relationshipTypes: [] };

    expect(interpretLoadUniverseKnowledgeResult(answered({ ok: true, value: emptyKnowledge }), vocabulary)).toEqual({
      status: "loaded",
      knowledge: emptyKnowledge,
    });
  });

  it.each([
    ["a value that is not an object", null],
    ["no list of works", { ...LOADED_KNOWLEDGE, works: undefined }],
    ["a work with an unknown medium", { ...LOADED_KNOWLEDGE, works: [{ ...STORED_WORK, medium: "OPERA" }] }],
    ["no list of entities", { ...LOADED_KNOWLEDGE, entities: "Frodo" }],
    ["an entity with an unknown type", { ...LOADED_KNOWLEDGE, entities: [{ ...STORED_ENTITY, type: "DRAGON" }] }],
    ["an entity without a name", { ...LOADED_KNOWLEDGE, entities: [{ ...STORED_ENTITY, name: null }] }],
    ["no list of relationship types", { ...LOADED_KNOWLEDGE, relationshipTypes: undefined }],
    [
      "a relationship type without its symmetric flag",
      { ...LOADED_KNOWLEDGE, relationshipTypes: [{ ...STORED_RELATIONSHIP_TYPE, isSymmetric: "yes" }] },
    ],
  ])("reads an answer with %s as failed", (_description, value) => {
    expect(interpretLoadUniverseKnowledgeResult(answered({ ok: true, value }), vocabulary)).toEqual({ status: "failed" });
  });

  it.each([
    ["a universe that is not found", failure("NOT_FOUND")],
    ["a malformed universe", failure("VALIDATION_ERROR", { universeId: [{ code: "ID_INVALID" }] })],
    ["a storage failure", failure("INFRASTRUCTURE_ERROR")],
    ["no answer in time", TIMED_OUT],
    ["a lost connection", rejected(new TypeError("Failed to fetch"))],
    ["an unverifiable session", rejected(new Error(SESSION_CHECK_FAILED_ACTION_REFUSAL.text))],
  ])("reads %s as failed", (_description, end) => {
    expect(interpretLoadUniverseKnowledgeResult(end, vocabulary)).toEqual({ status: "failed" });
  });

  it.each([
    ["the authentication error", failure("AUTHENTICATION_ERROR")],
    ["the signed-out refusal of the guard", rejected(new Error(SIGNED_OUT_ACTION_REFUSAL.text))],
  ])("reads %s as signed out", (_description, end) => {
    expect(interpretLoadUniverseKnowledgeResult(end, vocabulary)).toEqual({ status: "signed-out" });
  });
});
