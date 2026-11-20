import type { ValidationIssue } from "@/shared/domain/validation-error";

export const UNIVERSE_ID_FIELD = "universeId";
export const UNIVERSE_ID_INVALID_CODE = "UNIVERSE_ID_INVALID";

export type UniverseIdParsing =
  | { readonly isValid: true; readonly universeId: string }
  | { readonly isValid: false; readonly issue: ValidationIssue };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Accepts a well-formed UUID and returns it in lower case, so the same identifier is always
 * compared the same way. Anything else (missing, empty, not a string, malformed) is one
 * validation issue on the `universeId` field.
 */
export function parseUniverseId(value: unknown): UniverseIdParsing {
  if (typeof value === "string" && UUID_PATTERN.test(value)) {
    return { isValid: true, universeId: value.toLowerCase() };
  }

  return { isValid: false, issue: { field: UNIVERSE_ID_FIELD, code: UNIVERSE_ID_INVALID_CODE } };
}
