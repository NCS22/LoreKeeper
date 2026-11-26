import { en } from "@/messages/en";
import type {
  KnowledgeFormVocabulary,
  RelationshipFormFieldName,
} from "@/components/knowledge/knowledge-form-vocabulary";
import type { ActionFieldIssue } from "@/shared/presentation/action-result";

/**
 * Turns a validation issue of the work creation into the text shown under its field. Messages are
 * chosen by the stable issue code, which the page hands down in the vocabulary (the browser never
 * imports the knowledge module); the limits shown come from the issue, or else from the module.
 */
export function getWorkIssueMessage(issue: ActionFieldIssue, vocabulary: KnowledgeFormVocabulary): string {
  const messages = en.workCreation.issues;
  const codes = vocabulary.work.issueCodes;

  switch (issue.code) {
    case codes.titleRequired:
      return messages.TITLE_REQUIRED;
    case codes.titleTooLong:
      return messages.TITLE_TOO_LONG(issue.maximumLength ?? vocabulary.work.maximumTitleLength);
    case codes.titleInvalidCharacters:
      return messages.TITLE_INVALID_CHARACTERS;
    case codes.mediumInvalid:
      return messages.MEDIUM_INVALID;
    case codes.unitCountRequired:
      return messages.UNIT_COUNT_REQUIRED;
    case codes.unitCountInvalid:
      return messages.UNIT_COUNT_INVALID;
    case codes.unitCountOutOfRange:
      return messages.UNIT_COUNT_OUT_OF_RANGE(vocabulary.work.maximumUnitCount);
    default:
      return messages.UNKNOWN;
  }
}

/**
 * Turns a validation issue of the entity creation, its first fragment included, into the text shown
 * under its field, by the stable issue code (the work identifier code is only reported for the work of
 * a point in this form).
 */
export function getEntityIssueMessage(issue: ActionFieldIssue, vocabulary: KnowledgeFormVocabulary): string {
  const messages = en.entityCreation.issues;
  const codes = vocabulary.entity.issueCodes;

  switch (issue.code) {
    case codes.nameRequired:
      return messages.NAME_REQUIRED;
    case codes.nameTooLong:
      return messages.NAME_TOO_LONG(issue.maximumLength ?? vocabulary.entity.maximumNameLength);
    case codes.nameInvalidCharacters:
      return messages.NAME_INVALID_CHARACTERS;
    case codes.typeInvalid:
      return messages.TYPE_INVALID;
    case codes.workIdInvalid:
      return messages.WORK_INVALID;
    case codes.unitNumberRequired:
      return messages.UNIT_NUMBER_REQUIRED;
    case codes.unitNumberInvalid:
      return messages.UNIT_NUMBER_INVALID;
    case codes.contentTooLong:
      return messages.CONTENT_TOO_LONG(issue.maximumLength ?? vocabulary.entity.maximumFragmentContentLength);
    case codes.contentInvalidCharacters:
      return messages.CONTENT_INVALID_CHARACTERS;
    case codes.statusInvalid:
      return messages.STATUS_INVALID;
    default:
      return messages.UNKNOWN;
  }
}

/** What a malformed identifier asks for, by the field of the relationship form it was reported on. */
const RELATIONSHIP_ITEM_ID_MESSAGES: Readonly<Partial<Record<RelationshipFormFieldName, string>>> = {
  sourceEntityId: en.relationshipCreation.issues.SOURCE_INVALID,
  targetEntityId: en.relationshipCreation.issues.TARGET_INVALID,
  relationshipTypeId: en.relationshipCreation.issues.TYPE_INVALID,
  boundaryWorkId: en.relationshipCreation.issues.WORK_INVALID,
};

/**
 * Turns a validation issue of the relationship creation into the text shown under its field, by the
 * stable issue code. One code reports every malformed identifier (an entity, the type or the work of
 * the point), so its message depends on the field it was reported on.
 */
export function getRelationshipIssueMessage(
  issue: ActionFieldIssue,
  formField: RelationshipFormFieldName,
  vocabulary: KnowledgeFormVocabulary,
): string {
  const messages = en.relationshipCreation.issues;
  const codes = vocabulary.relationship.issueCodes;

  switch (issue.code) {
    case codes.itemIdInvalid:
      return RELATIONSHIP_ITEM_ID_MESSAGES[formField] ?? messages.UNKNOWN;
    case codes.unitNumberRequired:
      return messages.UNIT_NUMBER_REQUIRED;
    case codes.unitNumberInvalid:
      return messages.UNIT_NUMBER_INVALID;
    case codes.statusInvalid:
      return messages.STATUS_INVALID;
    default:
      return messages.UNKNOWN;
  }
}
