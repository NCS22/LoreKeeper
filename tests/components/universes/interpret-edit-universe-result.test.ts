import { describe, expect, it } from "vitest";
import { interpretEditUniverseResult } from "@/components/universes/interpret-edit-universe-result";
import { buildUniverseFormVocabulary } from "@/components/universes/build-universe-form-vocabulary";
import type { TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";
import { en } from "@/messages/en";
import {
  SESSION_CHECK_FAILED_ACTION_REFUSAL,
  SIGNED_OUT_ACTION_REFUSAL,
} from "@/shared/presentation/signed-out-action-response";

// The table "What the screen does with each answer" of specs/007a-universe-editing/plan.md, section 4.

const vocabulary = buildUniverseFormVocabulary();

const EDITED_UNIVERSE = {
  id: "4a7f3c2e-9b1d-4e6a-8c5f-0d2b7a1e3f90",
  name: "Middle-earth",
  description: "The lands of the Third Age.",
  mode: "READER",
  createdAt: "2026-11-17T10:00:00.000Z",
  updatedAt: "2026-11-28T09:30:00.000Z",
};

function answered(value: unknown): TimeLimitedOutcome<unknown> {
  return { status: "answered", value };
}

function rejected(error: unknown): TimeLimitedOutcome<unknown> {
  return { status: "rejected", error };
}

function failure(code: string, fieldErrors?: unknown): TimeLimitedOutcome<unknown> {
  return answered({ ok: false, error: { code, message: "A message.", fieldErrors } });
}

describe("interpretEditUniverseResult", () => {
  it("reads a well-formed edited universe as saved (FR-5)", () => {
    const outcome = interpretEditUniverseResult(answered({ ok: true, value: { universe: EDITED_UNIVERSE } }), vocabulary);

    expect(outcome).toEqual({ status: "saved", universe: EDITED_UNIVERSE });
  });

  it.each([
    ["no universe in the value", { ok: true, value: {} }],
    ["a universe without an identifier", { ok: true, value: { universe: { ...EDITED_UNIVERSE, id: 7 } } }],
    ["a universe without its update time", { ok: true, value: { universe: { ...EDITED_UNIVERSE, updatedAt: null } } }],
    ["a universe with an unknown mode", { ok: true, value: { universe: { ...EDITED_UNIVERSE, mode: "SPECTATOR" } } }],
    ["a body that is not an object", "ok"],
    ["a body without the ok flag", { value: {} }],
    ["a failure without its error", { ok: false }],
  ])("reads %s as a generic failure", (_description, body) => {
    expect(interpretEditUniverseResult(answered(body), vocabulary)).toEqual({ status: "generic-failure" });
  });

  it("gives the name and the description their own message and ignores fields it does not know (FR-6)", () => {
    const outcome = interpretEditUniverseResult(
      failure("VALIDATION_ERROR", {
        [vocabulary.fieldNames.name]: [{ code: vocabulary.issueCodes.nameTooLong, maximumLength: 120 }],
        [vocabulary.fieldNames.description]: [{ code: vocabulary.issueCodes.descriptionInvalidCharacters }],
        somethingElse: [{ code: "X" }],
      }),
      vocabulary,
    );

    expect(outcome).toEqual({
      status: "field-errors",
      messagesByField: {
        name: en.universeCreation.issues.NAME_TOO_LONG(120),
        description: en.universeCreation.issues.DESCRIPTION_INVALID_CHARACTERS,
      },
    });
  });

  it("reports only the field that failed when the description alone is rejected (FR-6)", () => {
    const outcome = interpretEditUniverseResult(
      failure("VALIDATION_ERROR", {
        [vocabulary.fieldNames.description]: [{ code: vocabulary.issueCodes.descriptionTooLong, maximumLength: 2000 }],
      }),
      vocabulary,
    );

    expect(outcome).toEqual({
      status: "field-errors",
      messagesByField: { description: en.universeCreation.issues.DESCRIPTION_TOO_LONG(2000) },
    });
  });

  it.each([
    ["the mode, which the edit form does not have", { [vocabulary.fieldNames.mode]: [{ code: vocabulary.issueCodes.modeInvalid }] }],
    ["the identifier", { universeId: [{ code: "UNIVERSE_ID_INVALID" }] }],
    ["the request", { request: [{ code: "CROSS_SITE_REQUEST" }] }],
    ["the input", { input: [{ code: "INVALID_INPUT" }] }],
    ["nothing at all", undefined],
  ])("reads a validation failure on %s, no field of the form, as a generic failure", (_description, fieldErrors) => {
    expect(interpretEditUniverseResult(failure("VALIDATION_ERROR", fieldErrors), vocabulary)).toEqual({
      status: "generic-failure",
    });
  });

  it("leaves the mode out of the messages when it fails together with a field of the form", () => {
    const outcome = interpretEditUniverseResult(
      failure("VALIDATION_ERROR", {
        [vocabulary.fieldNames.name]: [{ code: vocabulary.issueCodes.nameRequired }],
        [vocabulary.fieldNames.mode]: [{ code: vocabulary.issueCodes.modeInvalid }],
      }),
      vocabulary,
    );

    expect(outcome).toEqual({
      status: "field-errors",
      messagesByField: { name: en.universeCreation.issues.NAME_REQUIRED },
    });
  });

  it.each([
    ["the authentication error", failure("AUTHENTICATION_ERROR")],
    ["the refusal of the page guard", rejected(new Error(SIGNED_OUT_ACTION_REFUSAL.text))],
  ])("reads %s as asking to sign in again (FR-10)", (_description, outcome) => {
    expect(interpretEditUniverseResult(outcome, vocabulary)).toEqual({ status: "sign-in-again" });
  });

  it("reads the not found answer as a universe that is not available (FR-11)", () => {
    expect(interpretEditUniverseResult(failure("NOT_FOUND"), vocabulary)).toEqual({ status: "not-available" });
  });

  it.each([
    ["the refusal for a session that cannot be checked", rejected(new Error(SESSION_CHECK_FAILED_ACTION_REFUSAL.text))],
    ["an infrastructure failure", failure("INFRASTRUCTURE_ERROR")],
    ["an unknown failure", failure("UNKNOWN_ERROR")],
    ["a code it does not know", failure("SOMETHING_NEW")],
    ["a failure whose error is not an object", answered({ ok: false, error: "NOT_FOUND" })],
  ])("reads %s as a generic failure, never as signed out or not available (FR-10)", (_description, outcome) => {
    expect(interpretEditUniverseResult(outcome, vocabulary)).toEqual({ status: "generic-failure" });
  });

  it.each([
    ["a lost connection", rejected(new Error("Failed to fetch"))],
    ["a thrown value that is not an error", rejected("boom")],
    ["no answer in time", { status: "timed-out" } as const],
  ])("reads %s as an unknown result", (_description, outcome) => {
    expect(interpretEditUniverseResult(outcome, vocabulary)).toEqual({ status: "result-unknown" });
  });
});
