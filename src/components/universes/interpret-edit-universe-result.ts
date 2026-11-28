import type { TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";
import {
  classifyEnd,
  interpretFieldErrors,
  isUniverseDto,
} from "@/components/universes/interpret-universe-action-result";
import type {
  UniverseFormFieldName,
  UniverseFormVocabulary,
} from "@/components/universes/universe-form-vocabulary";
import { NOT_FOUND_ERROR_CODE } from "@/shared/domain/error-kinds";
import type { UniverseDto } from "@/modules/universes";

// What the screen does with every way a universe edit can end: the table "What the screen does with
// each answer" of specs/007a-universe-editing/plan.md, section 4. The end of the call is classified as
// for creation; the not found answer is read first, so the classification shared with the knowledge
// forms does not grow. Nothing here throws: an answer that does not have the expected shape is read as
// a generic failure.

/** The fields of the edit form: the mode cannot be changed, so it is never one of them. */
export type UniverseEditFieldName = Exclude<UniverseFormFieldName, "mode">;

/** The messages of the edit form fields the server rejected, one per field. */
export type UniverseEditFieldMessages = Partial<Record<UniverseEditFieldName, string>>;

export type EditOutcome =
  /** The universe was saved, or had no real change; the screen merges it into the list (FR-5). */
  | { readonly status: "saved"; readonly universe: UniverseDto }
  /** Messages under the fields; the typed values stay (FR-6). */
  | { readonly status: "field-errors"; readonly messagesByField: UniverseEditFieldMessages }
  /** No valid session: nothing was changed, the values stay and the person is offered the sign-in (FR-10). */
  | { readonly status: "sign-in-again" }
  /** A failure with nothing changed, including an unverifiable session, which is never read as signed out (FR-10). */
  | { readonly status: "generic-failure" }
  /** The universe is not an own, existing one; the message never says which case happened (FR-11). */
  | { readonly status: "not-available" }
  /** No usable answer: the universe may have been changed (FR-12). */
  | { readonly status: "result-unknown" };

export function interpretEditUniverseResult(
  outcome: TimeLimitedOutcome<unknown>,
  vocabulary: UniverseFormVocabulary,
): EditOutcome {
  if (isNotFoundAnswer(outcome)) return { status: "not-available" };

  const end = classifyEnd(outcome);

  switch (end.kind) {
    case "succeeded":
      return interpretEditedUniverse(end.value, vocabulary);
    case "validation-failed":
      return interpretEditFieldErrors(end.fieldErrors, vocabulary);
    case "signed-out":
      return { status: "sign-in-again" };
    case "failed":
      return { status: "generic-failure" };
    case "unknown-result":
      return { status: "result-unknown" };
  }
}

function isNotFoundAnswer(outcome: TimeLimitedOutcome<unknown>): boolean {
  if (outcome.status !== "answered") return false;
  const answer = outcome.value;
  return isRecord(answer) && answer.ok === false && isRecord(answer.error) && answer.error.code === NOT_FOUND_ERROR_CODE;
}

function interpretEditedUniverse(value: unknown, vocabulary: UniverseFormVocabulary): EditOutcome {
  if (!isRecord(value) || !isUniverseDto(value.universe, vocabulary)) return { status: "generic-failure" };
  return { status: "saved", universe: value.universe };
}

function interpretEditFieldErrors(fieldErrors: unknown, vocabulary: UniverseFormVocabulary): EditOutcome {
  const creationFormOutcome = interpretFieldErrors(fieldErrors, vocabulary);
  if (creationFormOutcome.status !== "field-errors") return { status: "generic-failure" };

  // The edit form has no mode field, so a message for the mode has nowhere to be shown.
  const { name, description } = creationFormOutcome.messagesByField;
  const messagesByField: UniverseEditFieldMessages = {
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
  };

  return Object.keys(messagesByField).length === 0
    ? { status: "generic-failure" }
    : { status: "field-errors", messagesByField };
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
}
