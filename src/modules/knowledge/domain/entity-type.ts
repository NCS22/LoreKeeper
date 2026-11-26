export const ENTITY_TYPES = [
  "CHARACTER",
  "LOCATION",
  "ORGANIZATION",
  "FACTION",
  "OBJECT",
  "ABILITY",
  "SPECIES",
  "CONCEPT",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_TYPE_FIELD = "type";
export const ENTITY_TYPE_INVALID_CODE = "TYPE_INVALID";

/** Returns the type when the value is exactly one of the known entity types, otherwise `null`. */
export function parseEntityType(value: unknown): EntityType | null {
  return ENTITY_TYPES.find((entityType) => entityType === value) ?? null;
}
