import type { TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";
import type { KnowledgeFormVocabulary, WorkFormFieldName } from "@/components/knowledge/knowledge-form-vocabulary";
import { getWorkIssueMessage } from "@/components/knowledge/knowledge-issue-messages";
import type { UniverseKnowledgeView } from "@/components/knowledge/knowledge-load-state";
import { classifyEnd, readIssues } from "@/components/universes/interpret-universe-action-result";
import type { EntitySummaryDto, RelationshipTypeDto, WorkDto } from "@/modules/knowledge";

// What the screen does with every way a knowledge action can end. The classification of the end
// (answer, refusal, no answer) is the one of the universe actions (specs/006-knowledge-items/plan.md,
// section 5); what is read from each answer is here. Nothing here throws: an answer that does not have
// the expected shape is read as a failure.

const WORK_FORM_FIELDS: readonly WorkFormFieldName[] = ["title", "medium", "unitCount"];

/** The messages of the work form fields the server rejected, one per field. */
export type WorkFieldMessages = Partial<Record<WorkFormFieldName, string>>;

export type WorkCreationOutcome =
  /** The work exists; the screen loads the knowledge of its universe again. */
  | { readonly status: "created"; readonly work: WorkDto }
  /** Messages under the fields; the typed values stay. */
  | { readonly status: "field-errors"; readonly messagesByField: WorkFieldMessages }
  /** No valid session: nothing was created, the values stay and the person is offered the sign-in. */
  | { readonly status: "sign-in-again" }
  /** A failure with nothing stored, an unverifiable session and a universe not found included. */
  | { readonly status: "generic-failure" }
  /** No usable answer: the work may exist. */
  | { readonly status: "result-unknown" };

export type KnowledgeLoadOutcome =
  | { readonly status: "loaded"; readonly knowledge: UniverseKnowledgeView }
  /** No valid session: the page goes to the sign-in, as when remembering a universe. */
  | { readonly status: "signed-out" }
  /** Any other end, no answer included: a read stores nothing, so it can be tried again. */
  | { readonly status: "failed" };

export function interpretCreateWorkResult(
  outcome: TimeLimitedOutcome<unknown>,
  vocabulary: KnowledgeFormVocabulary,
): WorkCreationOutcome {
  const end = classifyEnd(outcome);

  switch (end.kind) {
    case "succeeded":
      return isRecord(end.value) && isWorkDto(end.value.work, vocabulary)
        ? { status: "created", work: end.value.work }
        : { status: "generic-failure" };
    case "validation-failed":
      return interpretWorkFieldErrors(end.fieldErrors, vocabulary);
    case "signed-out":
      return { status: "sign-in-again" };
    case "failed":
      return { status: "generic-failure" };
    case "unknown-result":
      return { status: "result-unknown" };
  }
}

export function interpretLoadUniverseKnowledgeResult(
  outcome: TimeLimitedOutcome<unknown>,
  vocabulary: KnowledgeFormVocabulary,
): KnowledgeLoadOutcome {
  const end = classifyEnd(outcome);

  if (end.kind === "signed-out") return { status: "signed-out" };
  if (end.kind === "succeeded" && isUniverseKnowledge(end.value, vocabulary)) {
    return { status: "loaded", knowledge: end.value };
  }
  return { status: "failed" };
}

function interpretWorkFieldErrors(fieldErrors: unknown, vocabulary: KnowledgeFormVocabulary): WorkCreationOutcome {
  if (!isRecord(fieldErrors)) return { status: "generic-failure" };

  const messagesByField: WorkFieldMessages = {};
  for (const formField of WORK_FORM_FIELDS) {
    const firstIssue = readIssues(fieldErrors[vocabulary.work.fieldNames[formField]])[0];
    if (firstIssue !== undefined) messagesByField[formField] = getWorkIssueMessage(firstIssue, vocabulary);
  }

  // Issues that belong to no field of the form (a malformed universe identifier) leave nothing to show
  // on a field, so the person gets the generic failure.
  return Object.keys(messagesByField).length === 0
    ? { status: "generic-failure" }
    : { status: "field-errors", messagesByField };
}

function isUniverseKnowledge(candidate: unknown, vocabulary: KnowledgeFormVocabulary): candidate is UniverseKnowledgeView {
  return (
    isRecord(candidate) &&
    isListOf(candidate.works, (work) => isWorkDto(work, vocabulary)) &&
    isListOf(candidate.entities, (entity) => isEntitySummaryDto(entity, vocabulary)) &&
    isListOf(candidate.relationshipTypes, isRelationshipTypeDto)
  );
}

function isWorkDto(candidate: unknown, vocabulary: KnowledgeFormVocabulary): candidate is WorkDto {
  return (
    isRecord(candidate) &&
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.medium === "string" &&
    vocabulary.work.mediums.includes(candidate.medium) &&
    typeof candidate.unitWording === "string" &&
    Number.isInteger(candidate.unitCount) &&
    typeof candidate.createdAt === "string"
  );
}

function isEntitySummaryDto(candidate: unknown, vocabulary: KnowledgeFormVocabulary): candidate is EntitySummaryDto {
  return (
    isRecord(candidate) &&
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    vocabulary.entityTypes.includes(candidate.type) &&
    typeof candidate.createdAt === "string"
  );
}

function isRelationshipTypeDto(candidate: unknown): candidate is RelationshipTypeDto {
  return (
    isRecord(candidate) &&
    typeof candidate.id === "string" &&
    typeof candidate.key === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.inverseLabel === "string" &&
    typeof candidate.isSymmetric === "boolean"
  );
}

function isListOf(candidate: unknown, isItem: (item: unknown) => boolean): boolean {
  return Array.isArray(candidate) && candidate.every(isItem);
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
}
