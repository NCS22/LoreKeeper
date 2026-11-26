// Public interface of the knowledge module. Nothing outside the module imports anything else.
export { createKnowledgeModule } from "./composition";
export type { KnowledgeModule, UniverseKnowledge } from "./composition";
export type { CreateWorkCommand } from "./application/create-work";
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
