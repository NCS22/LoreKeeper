// Public interface of the knowledge module. Nothing outside the module imports anything else.
export { createKnowledgeModule } from "./composition";
export type { KnowledgeModule, UniverseKnowledge } from "./composition";
export type { CreateWorkCommand } from "./application/create-work";
export {
  ENTITY_BOUNDARY_UNIT_NUMBER_FIELD,
  ENTITY_BOUNDARY_WORK_ID_FIELD,
  FRAGMENT_BOUNDARY_UNIT_NUMBER_FIELD,
  FRAGMENT_BOUNDARY_WORK_ID_FIELD,
  FRAGMENT_STATUS_FIELD,
} from "./application/create-entity";
export type {
  BoundaryCommand,
  CreateEntityCommand,
  EntityCreation,
  FirstFragmentCommand,
} from "./application/create-entity";
export type { EntitySummaryDto } from "./application/entity-dto";
export type { WorkDto } from "./application/work-dto";
export type { UnitWording } from "./domain/unit-wording";
export { WORK_MEDIUM_FIELD, WORK_MEDIUM_INVALID_CODE, WORK_MEDIUMS } from "./domain/work-medium";
export type { WorkMedium } from "./domain/work-medium";
export {
  MAXIMUM_WORK_TITLE_LENGTH,
  WORK_TITLE_FIELD,
  WORK_TITLE_INVALID_CHARACTERS_CODE,
  WORK_TITLE_REQUIRED_CODE,
  WORK_TITLE_TOO_LONG_CODE,
} from "./domain/work-title";
export {
  MAXIMUM_UNIT_COUNT,
  UNIT_COUNT_FIELD,
  UNIT_COUNT_INVALID_CODE,
  UNIT_COUNT_OUT_OF_RANGE_CODE,
  UNIT_COUNT_REQUIRED_CODE,
} from "./domain/unit-count";
export {
  ENTITY_NAME_FIELD,
  ENTITY_NAME_INVALID_CHARACTERS_CODE,
  ENTITY_NAME_REQUIRED_CODE,
  ENTITY_NAME_TOO_LONG_CODE,
  MAXIMUM_ENTITY_NAME_LENGTH,
} from "./domain/entity-name";
export { ENTITY_TYPE_FIELD, ENTITY_TYPE_INVALID_CODE, ENTITY_TYPES } from "./domain/entity-type";
export type { EntityType } from "./domain/entity-type";
export {
  FRAGMENT_CONTENT_FIELD,
  FRAGMENT_CONTENT_INVALID_CHARACTERS_CODE,
  FRAGMENT_CONTENT_TOO_LONG_CODE,
  isBlankFragmentContent,
  MAXIMUM_FRAGMENT_CONTENT_LENGTH,
} from "./domain/fragment-content";
export { KNOWLEDGE_ITEM_ID_INVALID_CODE } from "./domain/knowledge-item-id";
export { KNOWLEDGE_STATUS_INVALID_CODE, KNOWLEDGE_STATUSES } from "./domain/knowledge-status";
export type { KnowledgeStatus } from "./domain/knowledge-status";
export { UNIT_NUMBER_INVALID_CODE, UNIT_NUMBER_REQUIRED_CODE } from "./domain/unit-number";
