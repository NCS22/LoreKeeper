import { describe, expect, it } from "vitest";
import {
  interpretCreateUniverseResult,
  interpretNameCheckResult,
  interpretRememberResult,
} from "@/components/universes/interpret-universe-action-result";
import { buildUniverseFormVocabulary } from "@/components/universes/build-universe-form-vocabulary";
import type { TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";
import { en } from "@/messages/en";
import {
  SESSION_CHECK_FAILED_ACTION_REFUSAL,
  SIGNED_OUT_ACTION_REFUSAL,
} from "@/shared/presentation/signed-out-action-response";

const vocabulary = buildUniverseFormVocabulary();

const STORED_UNIVERSE = {
  id: "4a7f3c2e-9b1d-4e6a-8c5f-0d2b7a1e3f90",
  name: "Middle-earth",
  description: null,
  mode: "READER",
  createdAt: "2026-11-17T10:00:00.000Z",
  updatedAt: "2026-11-17T10:00:00.000Z",
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

describe("interpretCreateUniverseResult", () => {
  it("reads a stored universe as created", () => {
    const outcome = interpretCreateUniverseResult(answered({ ok: true, value: { universe: STORED_UNIVERSE } }), vocabulary);

    expect(outcome).toEqual({ status: "created", universe: STORED_UNIVERSE });
  });

  it.each([
    ["no universe in the value", { ok: true, value: {} }],
    ["a universe without an identifier", { ok: true, value: { universe: { ...STORED_UNIVERSE, id: 7 } } }],
    ["a universe with an unknown mode", { ok: true, value: { universe: { ...STORED_UNIVERSE, mode: "SPECTATOR" } } }],
    ["a body that is not an object", "ok"],
    ["a body without the ok flag", { value: {} }],
    ["a failure without its error", { ok: false }],
  ])("reads %s as a generic failure", (_description, body) => {
    expect(interpretCreateUniverseResult(answered(body), vocabulary)).toEqual({ status: "generic-failure" });
  });

  it("gives each rejected field its own message and ignores fields it does not know", () => {
    const outcome = interpretCreateUniverseResult(
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

  it.each([
    ["the request", { request: [{ code: "CROSS_SITE_REQUEST" }] }],
    ["the input", { input: [{ code: "INVALID_INPUT" }] }],
    ["the identifier", { universeId: [{ code: "UNIVERSE_ID_INVALID" }] }],
    ["nothing at all", undefined],
  ])("reads a validation failure on %s as a generic failure", (_description, fieldErrors) => {
    expect(interpretCreateUniverseResult(failure("VALIDATION_ERROR", fieldErrors), vocabulary)).toEqual({
      status: "generic-failure",
    });
  });

  it.each([
    ["the authentication error", failure("AUTHENTICATION_ERROR")],
    ["the refusal of the page guard", rejected(new Error(SIGNED_OUT_ACTION_REFUSAL.text))],
  ])("reads %s as asking to sign in again", (_description, outcome) => {
    expect(interpretCreateUniverseResult(outcome, vocabulary)).toEqual({ status: "sign-in-again" });
  });

  it.each([
    ["an infrastructure failure", failure("INFRASTRUCTURE_ERROR")],
    ["an unknown failure", failure("UNKNOWN_ERROR")],
    ["a code it does not know", failure("SOMETHING_NEW")],
    ["a not found answer, which creation never produces", failure("NOT_FOUND")],
    ["the refusal for a session that cannot be checked", rejected(new Error(SESSION_CHECK_FAILED_ACTION_REFUSAL.text))],
  ])("reads %s as a generic failure, never as signed out", (_description, outcome) => {
    expect(interpretCreateUniverseResult(outcome, vocabulary)).toEqual({ status: "generic-failure" });
  });

  it.each([
    ["a lost connection", rejected(new Error("Failed to fetch"))],
    ["a thrown value that is not an error", rejected("boom")],
    ["no answer in time", { status: "timed-out" } as const],
  ])("reads %s as an unknown result", (_description, outcome) => {
    expect(interpretCreateUniverseResult(outcome, vocabulary)).toEqual({ status: "result-unknown" });
  });
});

describe("interpretNameCheckResult", () => {
  it.each([
    [true, "in-use"],
    [false, "not-in-use"],
  ])("reads isInUse %s as %s", (isInUse, expectedOutcome) => {
    expect(interpretNameCheckResult(answered({ ok: true, value: { isInUse } }))).toBe(expectedOutcome);
  });

  it.each([
    ["the authentication error", failure("AUTHENTICATION_ERROR")],
    ["the refusal of the page guard", rejected(new Error(SIGNED_OUT_ACTION_REFUSAL.text))],
  ])("reads %s as signed out", (_description, outcome) => {
    expect(interpretNameCheckResult(outcome)).toBe("signed-out");
  });

  it.each([
    ["a validation failure", failure("VALIDATION_ERROR", { name: [{ code: "X" }] })],
    ["an infrastructure failure", failure("INFRASTRUCTURE_ERROR")],
    ["an answer of the wrong shape", answered({ ok: true, value: { isInUse: "yes" } })],
    ["the refusal for a session that cannot be checked", rejected(new Error(SESSION_CHECK_FAILED_ACTION_REFUSAL.text))],
    ["a lost connection", rejected(new Error("Failed to fetch"))],
    ["no answer in time", { status: "timed-out" } as const],
  ])("shows no warning for %s", (_description, outcome) => {
    expect(interpretNameCheckResult(outcome)).toBe("not-in-use");
  });
});

describe("interpretRememberResult", () => {
  it("reads a success as remembered", () => {
    expect(interpretRememberResult(answered({ ok: true, value: null }))).toBe("remembered");
  });

  it.each([
    ["the authentication error", failure("AUTHENTICATION_ERROR")],
    ["the refusal of the page guard", rejected(new Error(SIGNED_OUT_ACTION_REFUSAL.text))],
  ])("reads %s as signed out", (_description, outcome) => {
    expect(interpretRememberResult(outcome)).toBe("signed-out");
  });

  it.each([
    ["a stale or foreign identifier", failure("NOT_FOUND")],
    ["a malformed identifier", failure("VALIDATION_ERROR", { universeId: [{ code: "UNIVERSE_ID_INVALID" }] })],
    ["an infrastructure failure", failure("INFRASTRUCTURE_ERROR")],
    ["an unknown failure", failure("UNKNOWN_ERROR")],
    ["the refusal for a session that cannot be checked", rejected(new Error(SESSION_CHECK_FAILED_ACTION_REFUSAL.text))],
    ["a lost connection", rejected(new Error("Failed to fetch"))],
    ["no answer in time", { status: "timed-out" } as const],
  ])("says nothing about %s", (_description, outcome) => {
    expect(interpretRememberResult(outcome)).toBe("ignored");
  });
});
