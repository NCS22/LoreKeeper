import { countTextCharacters, isStorableText } from "@/shared/domain/text-rules";
import type { ValidationIssue } from "@/shared/domain/validation-error";

export const MAXIMUM_FRAGMENT_CONTENT_LENGTH = 5000;

export const FRAGMENT_CONTENT_FIELD = "fragment.content";
export const FRAGMENT_CONTENT_TOO_LONG_CODE = "CONTENT_TOO_LONG";
export const FRAGMENT_CONTENT_INVALID_CHARACTERS_CODE = "CONTENT_INVALID_CHARACTERS";

/**
 * The content of a first fragment as typed: absent when it is empty or only whitespace (then there
 * is no fragment at all, FR-5), otherwise valid or invalid.
 */
export type FragmentContentReading =
  | { readonly isPresent: false }
  | { readonly isPresent: true; readonly isValid: true; readonly content: string }
  | { readonly isPresent: true; readonly isValid: false; readonly issue: ValidationIssue };

/**
 * Whether a fragment content is empty or only whitespace. Such a fragment does not exist: its
 * status and boundary are neither validated nor looked up (FR-5).
 */
export function isBlankFragmentContent(rawContent: string): boolean {
  return rawContent.trim().length === 0;
}

/**
 * Applies the content rules of a fragment (FR-5): surrounding whitespace is removed, a blank
 * content means no fragment, otherwise it must be a storable text of at most the maximum length in
 * code points.
 */
export function readFragmentContent(rawContent: string): FragmentContentReading {
  if (isBlankFragmentContent(rawContent)) {
    return { isPresent: false };
  }

  const content = rawContent.trim();

  if (!isStorableText(content)) {
    return {
      isPresent: true,
      isValid: false,
      issue: { field: FRAGMENT_CONTENT_FIELD, code: FRAGMENT_CONTENT_INVALID_CHARACTERS_CODE },
    };
  }

  if (countTextCharacters(content) > MAXIMUM_FRAGMENT_CONTENT_LENGTH) {
    return {
      isPresent: true,
      isValid: false,
      issue: {
        field: FRAGMENT_CONTENT_FIELD,
        code: FRAGMENT_CONTENT_TOO_LONG_CODE,
        maximumLength: MAXIMUM_FRAGMENT_CONTENT_LENGTH,
      },
    };
  }

  return { isPresent: true, isValid: true, content };
}
