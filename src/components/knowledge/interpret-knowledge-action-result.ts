import type { TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";
import type {
  EntityFormFieldName,
  KnowledgeFormVocabulary,
  RelationshipFormFieldName,
  WorkFormFieldName,
} from "@/components/knowledge/knowledge-form-vocabulary";
import {
  getEntityIssueMessage,
  getRelationshipIssueMessage,
  getWorkIssueMessage,
} from "@/components/knowledge/knowledge-issue-messages";
import type { UniverseKnowledgeView } from "@/components/knowledge/knowledge-load-state";
import { classifyEnd, readIssues } from "@/components/universes/interpret-universe-action-result";
import { en } from "@/messages/en";
import type {
  CreatedRelationshipDto,
  EntityDetailsDto,
  EntitySummaryDto,
  FirstFragmentDto,
  PointDto,
  RelationshipReadingDto,
  RelationshipTypeDto,
  WorkDto,
} from "@/modules/knowledge";
import type { ActionFieldIssue } from "@/shared/presentation/action-result";

// What the screen does with every way a knowledge action can end. The classification of the end
// (answer, refusal, no answer) is the one of the universe actions (specs/006-knowledge-items/plan.md,
// section 5); what is read from each answer is here. Nothing here throws: an answer that does not have
// the expected shape is read as a failure.

const WORK_FORM_FIELDS: readonly WorkFormFieldName[] = ["title", "medium", "unitCount"];
const ENTITY_FORM_FIELDS: readonly EntityFormFieldName[] = [
  "name",
  "type",
  "boundaryWorkId",
  "boundaryUnitNumber",
  "fragmentContent",
  "fragmentStatus",
  "fragmentBoundaryWorkId",
  "fragmentBoundaryUnitNumber",
];

const RELATIONSHIP_FORM_FIELDS: readonly RelationshipFormFieldName[] = [
  "sourceEntityId",
  "targetEntityId",
  "relationshipTypeId",
  "status",
  "boundaryWorkId",
  "boundaryUnitNumber",
];

/** The messages of the work form fields the server rejected, one per field. */
export type WorkFieldMessages = Partial<Record<WorkFormFieldName, string>>;

/** The messages of the entity form fields the server rejected, one per field. */
export type EntityFieldMessages = Partial<Record<EntityFormFieldName, string>>;

/** The messages of the relationship form fields the server rejected, one per field. */
export type RelationshipFieldMessages = Partial<Record<RelationshipFormFieldName, string>>;

/** How a creation of the knowledge forms ended when nothing was created, or when it is not known. */
type CreationFailureOutcome =
  /** No valid session: nothing was created, the values stay and the person is offered the sign-in. */
  | { readonly status: "sign-in-again" }
  /** A failure with nothing stored, an unverifiable session and a reference not found included. */
  | { readonly status: "generic-failure" }
  /** No usable answer: the item may exist. */
  | { readonly status: "result-unknown" };

export type EntityCreationOutcome =
  /** The entity exists; `similarEntityName` names the oldest similar entity, or is null (FR-6). */
  | { readonly status: "created"; readonly entity: EntitySummaryDto; readonly similarEntityName: string | null }
  /** Messages under the fields; the typed values stay. */
  | { readonly status: "field-errors"; readonly messagesByField: EntityFieldMessages }
  | CreationFailureOutcome;

export type RelationshipCreationOutcome =
  /** The relationship exists; the screen loads the universe, and the details of the selected entity, again. */
  | { readonly status: "created"; readonly relationship: CreatedRelationshipDto }
  /** Messages under the fields, the refusal of an entity related to itself included; the typed values stay. */
  | { readonly status: "field-errors"; readonly messagesByField: RelationshipFieldMessages }
  | CreationFailureOutcome;

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

export type EntityDetailsLoadOutcome =
  | { readonly status: "loaded"; readonly details: EntityDetailsDto }
  /** No valid session: the page goes to the sign-in, as for the load of the universe. */
  | { readonly status: "signed-out" }
  /** Any other end, no answer and an entity not found included: a read stores nothing, so it can be tried again. */
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
    case "validation-failed": {
      const messagesByField = readFieldMessages(
        end.fieldErrors,
        WORK_FORM_FIELDS,
        vocabulary.work.fieldNames,
        (issue) => getWorkIssueMessage(issue, vocabulary),
      );
      return messagesByField === null ? { status: "generic-failure" } : { status: "field-errors", messagesByField };
    }
    case "signed-out":
      return { status: "sign-in-again" };
    case "failed":
      return { status: "generic-failure" };
    case "unknown-result":
      return { status: "result-unknown" };
  }
}

export function interpretCreateEntityResult(
  outcome: TimeLimitedOutcome<unknown>,
  vocabulary: KnowledgeFormVocabulary,
): EntityCreationOutcome {
  const end = classifyEnd(outcome);

  switch (end.kind) {
    case "succeeded":
      return isRecord(end.value) &&
        isEntitySummaryDto(end.value.entity, vocabulary) &&
        (end.value.similarEntityName === null || typeof end.value.similarEntityName === "string")
        ? { status: "created", entity: end.value.entity, similarEntityName: end.value.similarEntityName }
        : { status: "generic-failure" };
    case "validation-failed": {
      const messagesByField = readFieldMessages(
        end.fieldErrors,
        ENTITY_FORM_FIELDS,
        vocabulary.entity.fieldNames,
        (issue) => getEntityIssueMessage(issue, vocabulary),
      );
      return messagesByField === null ? { status: "generic-failure" } : { status: "field-errors", messagesByField };
    }
    case "signed-out":
      return { status: "sign-in-again" };
    case "failed":
      return { status: "generic-failure" };
    case "unknown-result":
      return { status: "result-unknown" };
  }
}

export function interpretCreateRelationshipResult(
  outcome: TimeLimitedOutcome<unknown>,
  vocabulary: KnowledgeFormVocabulary,
): RelationshipCreationOutcome {
  // The one business rule of the creation is shown on the field the person changes to fix it (FR-8).
  if (isFailureWithCode(outcome, vocabulary.relationship.relatedToItselfCode)) {
    return { status: "field-errors", messagesByField: { targetEntityId: en.relationshipCreation.issues.RELATED_TO_ITSELF } };
  }

  const end = classifyEnd(outcome);

  switch (end.kind) {
    case "succeeded":
      return isRecord(end.value) && isCreatedRelationshipDto(end.value.relationship)
        ? { status: "created", relationship: end.value.relationship }
        : { status: "generic-failure" };
    case "validation-failed": {
      const messagesByField = readFieldMessages(
        end.fieldErrors,
        RELATIONSHIP_FORM_FIELDS,
        vocabulary.relationship.fieldNames,
        (issue, formField) => getRelationshipIssueMessage(issue, formField, vocabulary),
      );
      return messagesByField === null ? { status: "generic-failure" } : { status: "field-errors", messagesByField };
    }
    case "signed-out":
      return { status: "sign-in-again" };
    case "failed":
      return { status: "generic-failure" };
    case "unknown-result":
      return { status: "result-unknown" };
  }
}

export function interpretLoadEntityDetailsResult(
  outcome: TimeLimitedOutcome<unknown>,
  vocabulary: KnowledgeFormVocabulary,
): EntityDetailsLoadOutcome {
  const end = classifyEnd(outcome);

  if (end.kind === "signed-out") return { status: "signed-out" };
  if (end.kind === "succeeded" && isRecord(end.value) && isEntityDetailsDto(end.value.entity, vocabulary)) {
    return { status: "loaded", details: end.value.entity };
  }
  return { status: "failed" };
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

/**
 * The message of the first issue of each form field the server rejected, or null when there is none to
 * show: issues that belong to no field of the form (a malformed universe identifier) leave nothing to
 * show on a field, so the person gets the generic failure.
 */
function readFieldMessages<FormFieldName extends string>(
  fieldErrors: unknown,
  formFields: readonly FormFieldName[],
  issueFieldNames: Readonly<Record<FormFieldName, string>>,
  toMessage: (issue: ActionFieldIssue, formField: FormFieldName) => string,
): Partial<Record<FormFieldName, string>> | null {
  if (!isRecord(fieldErrors)) return null;

  const messagesByField: Partial<Record<FormFieldName, string>> = {};
  for (const formField of formFields) {
    const firstIssue = readIssues(fieldErrors[issueFieldNames[formField]])[0];
    if (firstIssue !== undefined) messagesByField[formField] = toMessage(firstIssue, formField);
  }
  return Object.keys(messagesByField).length === 0 ? null : messagesByField;
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

function isCreatedRelationshipDto(candidate: unknown): candidate is CreatedRelationshipDto {
  return (
    isRecord(candidate) &&
    typeof candidate.id === "string" &&
    typeof candidate.sourceEntityId === "string" &&
    typeof candidate.targetEntityId === "string"
  );
}

function isEntityDetailsDto(candidate: unknown, vocabulary: KnowledgeFormVocabulary): candidate is EntityDetailsDto {
  return (
    isRecord(candidate) &&
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    vocabulary.entityTypes.includes(candidate.type) &&
    isPointDto(candidate.introducedAt) &&
    (candidate.firstFragment === null || isFirstFragmentDto(candidate.firstFragment, vocabulary)) &&
    isListOf(candidate.relationships, (relationship) => isRelationshipReadingDto(relationship, vocabulary))
  );
}

function isFirstFragmentDto(candidate: unknown, vocabulary: KnowledgeFormVocabulary): candidate is FirstFragmentDto {
  return (
    isRecord(candidate) &&
    typeof candidate.content === "string" &&
    isKnownStatus(candidate.status, vocabulary) &&
    isPointDto(candidate.point)
  );
}

function isRelationshipReadingDto(
  candidate: unknown,
  vocabulary: KnowledgeFormVocabulary,
): candidate is RelationshipReadingDto {
  return (
    isRecord(candidate) &&
    typeof candidate.id === "string" &&
    isKnownStatus(candidate.status, vocabulary) &&
    isPointDto(candidate.point) &&
    typeof candidate.subjectName === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.otherName === "string"
  );
}

function isPointDto(candidate: unknown): candidate is PointDto {
  return (
    isRecord(candidate) &&
    typeof candidate.workId === "string" &&
    typeof candidate.workTitle === "string" &&
    typeof candidate.unitWording === "string" &&
    typeof candidate.unitLabel === "string"
  );
}

function isKnownStatus(candidate: unknown, vocabulary: KnowledgeFormVocabulary): boolean {
  return typeof candidate === "string" && vocabulary.relationship.statuses.includes(candidate);
}

/** True when the action answered a failure with this code, a refusal the shared classification reads as generic. */
function isFailureWithCode(outcome: TimeLimitedOutcome<unknown>, errorCode: string): boolean {
  return (
    outcome.status === "answered" &&
    isRecord(outcome.value) &&
    outcome.value.ok === false &&
    isRecord(outcome.value.error) &&
    outcome.value.error.code === errorCode
  );
}

function isListOf(candidate: unknown, isItem: (item: unknown) => boolean): boolean {
  return Array.isArray(candidate) && candidate.every(isItem);
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
}
