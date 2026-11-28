import type { TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";
import { getUniverseIssueMessage } from "@/components/universes/universe-issue-messages";
import type {
  UniverseFormFieldName,
  UniverseFormVocabulary,
} from "@/components/universes/universe-form-vocabulary";
import { AUTHENTICATION_ERROR_CODE } from "@/shared/domain/error-kinds";
import { VALIDATION_ERROR_CODE } from "@/shared/domain/validation-error";
import type { ActionFieldIssue } from "@/shared/presentation/action-result";
import {
  SESSION_CHECK_FAILED_ACTION_REFUSAL,
  SIGNED_OUT_ACTION_REFUSAL,
} from "@/shared/presentation/signed-out-action-response";
import type { UniverseDto } from "@/modules/universes";

// What the screen does with every way a universe action can end. It is the table "What the screen
// does with each answer" of specs/004-stored-universes/plan.md, section 4. Nothing here throws: an
// answer that does not have the expected shape is read as a generic failure.

const UNIVERSE_FORM_FIELDS: readonly UniverseFormFieldName[] = ["name", "description", "mode"];

/** The messages of the form fields the server rejected, one per field. */
export type UniverseFieldMessages = Partial<Record<UniverseFormFieldName, string>>;

export type CreationOutcome =
  /** The universe exists; the screen adds it, selects it and remembers it. */
  | { readonly status: "created"; readonly universe: UniverseDto }
  /** Messages under the fields; the typed values stay. */
  | { readonly status: "field-errors"; readonly messagesByField: UniverseFieldMessages }
  /** No valid session: nothing was created, the values stay and the person is offered the sign-in (FR-10). */
  | { readonly status: "sign-in-again" }
  /** A failure with nothing stored, including an unverifiable session, which is never read as signed out (FR-7, FR-33). */
  | { readonly status: "generic-failure" }
  /** No usable answer: the universe may exist (FR-8). */
  | { readonly status: "result-unknown" };

/** The duplicate-name warning shows only for `in-use`; `signed-out` sends the person to sign in. */
export type NameCheckOutcome = "in-use" | "not-in-use" | "signed-out";

/** Remembering the selection is silent (FR-30) unless the session is missing (FR-32). */
export type RememberOutcome = "remembered" | "signed-out" | "ignored";

/** How an action call ended, before it is read for one form; shared with the knowledge forms (spec 006). */
export type ClassifiedEnd =
  | { readonly kind: "succeeded"; readonly value: unknown }
  | { readonly kind: "validation-failed"; readonly fieldErrors: unknown }
  | { readonly kind: "signed-out" }
  | { readonly kind: "failed" }
  | { readonly kind: "unknown-result" };

export function interpretCreateUniverseResult(
  outcome: TimeLimitedOutcome<unknown>,
  vocabulary: UniverseFormVocabulary,
): CreationOutcome {
  const end = classifyEnd(outcome);

  switch (end.kind) {
    case "succeeded":
      return interpretCreatedUniverse(end.value, vocabulary);
    case "validation-failed":
      return interpretFieldErrors(end.fieldErrors, vocabulary);
    case "signed-out":
      return { status: "sign-in-again" };
    case "failed":
      return { status: "generic-failure" };
    case "unknown-result":
      return { status: "result-unknown" };
  }
}

export function interpretNameCheckResult(outcome: TimeLimitedOutcome<unknown>): NameCheckOutcome {
  const end = classifyEnd(outcome);

  if (end.kind === "signed-out") return "signed-out";
  if (end.kind === "succeeded" && isRecord(end.value) && end.value.isInUse === true) return "in-use";
  return "not-in-use";
}

export function interpretRememberResult(outcome: TimeLimitedOutcome<unknown>): RememberOutcome {
  const end = classifyEnd(outcome);

  if (end.kind === "signed-out") return "signed-out";
  return end.kind === "succeeded" ? "remembered" : "ignored";
}

export function classifyEnd(outcome: TimeLimitedOutcome<unknown>): ClassifiedEnd {
  switch (outcome.status) {
    case "timed-out":
      return { kind: "unknown-result" };
    case "rejected":
      return classifyRejection(outcome.error);
    case "answered":
      return classifyAnswer(outcome.value);
  }
}

function classifyRejection(error: unknown): ClassifiedEnd {
  if (error instanceof Error && error.message === SIGNED_OUT_ACTION_REFUSAL.text) {
    return { kind: "signed-out" };
  }
  if (error instanceof Error && error.message === SESSION_CHECK_FAILED_ACTION_REFUSAL.text) {
    return { kind: "failed" };
  }
  return { kind: "unknown-result" };
}

function classifyAnswer(answer: unknown): ClassifiedEnd {
  if (!isRecord(answer)) return { kind: "failed" };
  if (answer.ok === true) return { kind: "succeeded", value: answer.value };
  if (answer.ok !== false || !isRecord(answer.error)) return { kind: "failed" };

  if (answer.error.code === AUTHENTICATION_ERROR_CODE) return { kind: "signed-out" };
  if (answer.error.code === VALIDATION_ERROR_CODE) {
    return { kind: "validation-failed", fieldErrors: answer.error.fieldErrors };
  }
  return { kind: "failed" };
}

function interpretCreatedUniverse(value: unknown, vocabulary: UniverseFormVocabulary): CreationOutcome {
  if (!isRecord(value) || !isUniverseDto(value.universe, vocabulary)) return { status: "generic-failure" };
  return { status: "created", universe: value.universe };
}

/** The message under each creation form field the server rejected; no such field is a generic failure. */
export function interpretFieldErrors(fieldErrors: unknown, vocabulary: UniverseFormVocabulary): CreationOutcome {
  if (!isRecord(fieldErrors)) return { status: "generic-failure" };

  const messagesByField: UniverseFieldMessages = {};
  for (const formField of UNIVERSE_FORM_FIELDS) {
    const firstIssue = readIssues(fieldErrors[vocabulary.fieldNames[formField]])[0];
    if (firstIssue !== undefined) messagesByField[formField] = getUniverseIssueMessage(firstIssue, vocabulary);
  }

  // Issues that belong to no field of the form (a rejected request, a malformed identifier) leave
  // nothing to show on a field, so the person gets the generic failure.
  return Object.keys(messagesByField).length === 0
    ? { status: "generic-failure" }
    : { status: "field-errors", messagesByField };
}

/** The well-formed issues of one field; anything else in the list is left out. */
export function readIssues(issues: unknown): ActionFieldIssue[] {
  return Array.isArray(issues) ? issues.filter(isFieldIssue) : [];
}

function isFieldIssue(candidate: unknown): candidate is ActionFieldIssue {
  return (
    isRecord(candidate) &&
    typeof candidate.code === "string" &&
    isOptionalNumber(candidate.minimumLength) &&
    isOptionalNumber(candidate.maximumLength)
  );
}

/** True when an answer carries a universe with every field the screen reads, in a mode it knows. */
export function isUniverseDto(candidate: unknown, vocabulary: UniverseFormVocabulary): candidate is UniverseDto {
  return (
    isRecord(candidate) &&
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    (candidate.description === null || typeof candidate.description === "string") &&
    typeof candidate.mode === "string" &&
    vocabulary.modes.includes(candidate.mode) &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

function isOptionalNumber(candidate: unknown): boolean {
  return candidate === undefined || typeof candidate === "number";
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
}
