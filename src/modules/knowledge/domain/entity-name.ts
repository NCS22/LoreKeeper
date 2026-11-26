import { countTextCharacters, isStorableText } from "@/shared/domain/text-rules";
import type { ValidationIssue } from "@/shared/domain/validation-error";

export const MAXIMUM_ENTITY_NAME_LENGTH = 120;

export const ENTITY_NAME_FIELD = "name";
export const ENTITY_NAME_REQUIRED_CODE = "NAME_REQUIRED";
export const ENTITY_NAME_TOO_LONG_CODE = "NAME_TOO_LONG";
export const ENTITY_NAME_INVALID_CHARACTERS_CODE = "NAME_INVALID_CHARACTERS";

export type EntityNameValidation =
  | { readonly isValid: true; readonly name: string }
  | { readonly isValid: false; readonly issue: ValidationIssue };

/**
 * Applies the name rules of an entity (FR-4): surrounding whitespace is removed, the result must
 * not be empty, must be a storable text and its length in code points must not exceed the maximum.
 * A name already used by another entity is allowed (FR-6 only gives a notice).
 */
export function validateEntityName(rawName: string): EntityNameValidation {
  const name = rawName.trim();

  if (name.length === 0) {
    return { isValid: false, issue: { field: ENTITY_NAME_FIELD, code: ENTITY_NAME_REQUIRED_CODE } };
  }

  if (!isStorableText(name)) {
    return {
      isValid: false,
      issue: { field: ENTITY_NAME_FIELD, code: ENTITY_NAME_INVALID_CHARACTERS_CODE },
    };
  }

  if (countTextCharacters(name) > MAXIMUM_ENTITY_NAME_LENGTH) {
    return {
      isValid: false,
      issue: {
        field: ENTITY_NAME_FIELD,
        code: ENTITY_NAME_TOO_LONG_CODE,
        maximumLength: MAXIMUM_ENTITY_NAME_LENGTH,
      },
    };
  }

  return { isValid: true, name };
}
