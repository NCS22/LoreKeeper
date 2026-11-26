import {
  ENTITY_BOUNDARY_UNIT_NUMBER_FIELD,
  ENTITY_BOUNDARY_WORK_ID_FIELD,
  ENTITY_NAME_FIELD,
  ENTITY_NAME_INVALID_CHARACTERS_CODE,
  ENTITY_NAME_REQUIRED_CODE,
  ENTITY_NAME_TOO_LONG_CODE,
  ENTITY_TYPE_FIELD,
  ENTITY_TYPE_INVALID_CODE,
  ENTITY_TYPES,
  FRAGMENT_BOUNDARY_UNIT_NUMBER_FIELD,
  FRAGMENT_BOUNDARY_WORK_ID_FIELD,
  FRAGMENT_CONTENT_FIELD,
  FRAGMENT_CONTENT_INVALID_CHARACTERS_CODE,
  FRAGMENT_CONTENT_TOO_LONG_CODE,
  FRAGMENT_STATUS_FIELD,
  KNOWLEDGE_ITEM_ID_INVALID_CODE,
  KNOWLEDGE_STATUS_INVALID_CODE,
  KNOWLEDGE_STATUSES,
  MAXIMUM_ENTITY_NAME_LENGTH,
  MAXIMUM_FRAGMENT_CONTENT_LENGTH,
  MAXIMUM_UNIT_COUNT,
  MAXIMUM_WORK_TITLE_LENGTH,
  RELATIONSHIP_BOUNDARY_UNIT_NUMBER_FIELD,
  RELATIONSHIP_BOUNDARY_WORK_ID_FIELD,
  RELATIONSHIP_SOURCE_ENTITY_ID_FIELD,
  RELATIONSHIP_STATUS_FIELD,
  RELATIONSHIP_TARGET_ENTITY_ID_FIELD,
  RELATIONSHIP_TYPE_ID_FIELD,
  UNIT_COUNT_FIELD,
  UNIT_COUNT_INVALID_CODE,
  UNIT_COUNT_OUT_OF_RANGE_CODE,
  UNIT_COUNT_REQUIRED_CODE,
  UNIT_NUMBER_INVALID_CODE,
  UNIT_NUMBER_REQUIRED_CODE,
  WORK_MEDIUM_FIELD,
  WORK_MEDIUM_INVALID_CODE,
  WORK_MEDIUMS,
  WORK_TITLE_FIELD,
  WORK_TITLE_INVALID_CHARACTERS_CODE,
  WORK_TITLE_REQUIRED_CODE,
  WORK_TITLE_TOO_LONG_CODE,
} from "@/modules/knowledge";
import type { KnowledgeFormVocabulary } from "@/components/knowledge/knowledge-form-vocabulary";
import { BUSINESS_RULE_VIOLATION_ERROR_CODE } from "@/shared/domain/error-kinds";

/**
 * SERVER ONLY. Reads the field names, issue codes, media, entity types, statuses and limits of the knowledge
 * module, to be passed as a prop to the knowledge provider. A client component must never import
 * this file: the knowledge module also exports server-only wiring, and the production build fails if
 * it does.
 */
export function buildKnowledgeFormVocabulary(): KnowledgeFormVocabulary {
  return {
    work: {
      fieldNames: {
        title: WORK_TITLE_FIELD,
        medium: WORK_MEDIUM_FIELD,
        unitCount: UNIT_COUNT_FIELD,
      },
      issueCodes: {
        titleRequired: WORK_TITLE_REQUIRED_CODE,
        titleTooLong: WORK_TITLE_TOO_LONG_CODE,
        titleInvalidCharacters: WORK_TITLE_INVALID_CHARACTERS_CODE,
        mediumInvalid: WORK_MEDIUM_INVALID_CODE,
        unitCountRequired: UNIT_COUNT_REQUIRED_CODE,
        unitCountInvalid: UNIT_COUNT_INVALID_CODE,
        unitCountOutOfRange: UNIT_COUNT_OUT_OF_RANGE_CODE,
      },
      mediums: WORK_MEDIUMS,
      maximumTitleLength: MAXIMUM_WORK_TITLE_LENGTH,
      maximumUnitCount: MAXIMUM_UNIT_COUNT,
    },
    entity: {
      fieldNames: {
        name: ENTITY_NAME_FIELD,
        type: ENTITY_TYPE_FIELD,
        boundaryWorkId: ENTITY_BOUNDARY_WORK_ID_FIELD,
        boundaryUnitNumber: ENTITY_BOUNDARY_UNIT_NUMBER_FIELD,
        fragmentContent: FRAGMENT_CONTENT_FIELD,
        fragmentStatus: FRAGMENT_STATUS_FIELD,
        fragmentBoundaryWorkId: FRAGMENT_BOUNDARY_WORK_ID_FIELD,
        fragmentBoundaryUnitNumber: FRAGMENT_BOUNDARY_UNIT_NUMBER_FIELD,
      },
      issueCodes: {
        nameRequired: ENTITY_NAME_REQUIRED_CODE,
        nameTooLong: ENTITY_NAME_TOO_LONG_CODE,
        nameInvalidCharacters: ENTITY_NAME_INVALID_CHARACTERS_CODE,
        typeInvalid: ENTITY_TYPE_INVALID_CODE,
        workIdInvalid: KNOWLEDGE_ITEM_ID_INVALID_CODE,
        unitNumberRequired: UNIT_NUMBER_REQUIRED_CODE,
        unitNumberInvalid: UNIT_NUMBER_INVALID_CODE,
        contentTooLong: FRAGMENT_CONTENT_TOO_LONG_CODE,
        contentInvalidCharacters: FRAGMENT_CONTENT_INVALID_CHARACTERS_CODE,
        statusInvalid: KNOWLEDGE_STATUS_INVALID_CODE,
      },
      statuses: KNOWLEDGE_STATUSES,
      maximumNameLength: MAXIMUM_ENTITY_NAME_LENGTH,
      maximumFragmentContentLength: MAXIMUM_FRAGMENT_CONTENT_LENGTH,
    },
    relationship: {
      fieldNames: {
        sourceEntityId: RELATIONSHIP_SOURCE_ENTITY_ID_FIELD,
        targetEntityId: RELATIONSHIP_TARGET_ENTITY_ID_FIELD,
        relationshipTypeId: RELATIONSHIP_TYPE_ID_FIELD,
        status: RELATIONSHIP_STATUS_FIELD,
        boundaryWorkId: RELATIONSHIP_BOUNDARY_WORK_ID_FIELD,
        boundaryUnitNumber: RELATIONSHIP_BOUNDARY_UNIT_NUMBER_FIELD,
      },
      issueCodes: {
        itemIdInvalid: KNOWLEDGE_ITEM_ID_INVALID_CODE,
        unitNumberRequired: UNIT_NUMBER_REQUIRED_CODE,
        unitNumberInvalid: UNIT_NUMBER_INVALID_CODE,
        statusInvalid: KNOWLEDGE_STATUS_INVALID_CODE,
      },
      // The relationship to itself is the only business rule the relationship creation checks.
      relatedToItselfCode: BUSINESS_RULE_VIOLATION_ERROR_CODE,
      statuses: KNOWLEDGE_STATUSES,
    },
    entityTypes: ENTITY_TYPES,
  };
}
