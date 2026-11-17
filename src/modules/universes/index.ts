// Public interface of the universes module. Nothing outside the module imports anything else.
export { createUniversesModule } from "./composition";
export type { UniversesModule } from "./composition";
// TEMPORARY bridge for the browser, deleted with the client data layer.
export { createUniversesInMemory } from "./prototype-composition";
export type { PrototypeUniversesModule } from "./prototype-composition";
export type { CreateUniverseCommand } from "./application/create-universe";
export type { RememberUniverseCommand } from "./application/remember-universe";
export type { WorkspaceUniverses } from "./application/load-workspace-universes";
export type { UniverseDto } from "./application/universe-dto";
export { UNIVERSE_MODE_FIELD, UNIVERSE_MODE_INVALID_CODE } from "./application/create-universe";
export { DEFAULT_UNIVERSE_MODE, UNIVERSE_MODES } from "./domain/universe-mode";
export type { UniverseMode } from "./domain/universe-mode";
export {
  UNIVERSE_NAME_FIELD,
  UNIVERSE_NAME_INVALID_CHARACTERS_CODE,
  UNIVERSE_NAME_REQUIRED_CODE,
  UNIVERSE_NAME_TOO_LONG_CODE,
} from "./domain/universe-name";
export {
  UNIVERSE_DESCRIPTION_FIELD,
  UNIVERSE_DESCRIPTION_INVALID_CHARACTERS_CODE,
  UNIVERSE_DESCRIPTION_TOO_LONG_CODE,
} from "./domain/universe-description";
