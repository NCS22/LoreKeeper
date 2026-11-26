import {
  ENTITY_TYPES,
  MAXIMUM_UNIT_COUNT,
  MAXIMUM_WORK_TITLE_LENGTH,
  UNIT_COUNT_FIELD,
  UNIT_COUNT_INVALID_CODE,
  UNIT_COUNT_OUT_OF_RANGE_CODE,
  UNIT_COUNT_REQUIRED_CODE,
  WORK_MEDIUM_FIELD,
  WORK_MEDIUM_INVALID_CODE,
  WORK_MEDIUMS,
  WORK_TITLE_FIELD,
  WORK_TITLE_INVALID_CHARACTERS_CODE,
  WORK_TITLE_REQUIRED_CODE,
  WORK_TITLE_TOO_LONG_CODE,
} from "@/modules/knowledge";
import type { KnowledgeFormVocabulary } from "@/components/knowledge/knowledge-form-vocabulary";

/**
 * SERVER ONLY. Reads the field names, issue codes, media, entity types and limits of the knowledge
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
    entityTypes: ENTITY_TYPES,
  };
}
