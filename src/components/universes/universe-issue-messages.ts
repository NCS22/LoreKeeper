import { en } from "@/messages/en";
import {
  UNIVERSE_DESCRIPTION_TOO_LONG_CODE,
  UNIVERSE_MODE_INVALID_CODE,
  UNIVERSE_NAME_REQUIRED_CODE,
  UNIVERSE_NAME_TOO_LONG_CODE,
} from "@/modules/universes";
import type { ValidationIssue } from "@/shared/domain/validation-error";

function readMaximumLength(issue: ValidationIssue): number {
  // A length rule always reports its limit; the UI never supplies one of its own (NFR-5).
  if (issue.maximumLength === undefined) {
    throw new Error(`Validation issue ${issue.code} on ${issue.field} carries no maximumLength`);
  }
  return issue.maximumLength;
}

/**
 * Turns a validation issue of universe creation into the text shown under its field.
 * Messages are chosen by the stable issue code; any limit shown comes from the issue details.
 */
export function getUniverseIssueMessage(issue: ValidationIssue): string {
  const messages = en.universeCreation.issues;

  switch (issue.code) {
    case UNIVERSE_NAME_REQUIRED_CODE:
      return messages.NAME_REQUIRED;
    case UNIVERSE_NAME_TOO_LONG_CODE:
      return messages.NAME_TOO_LONG(readMaximumLength(issue));
    case UNIVERSE_DESCRIPTION_TOO_LONG_CODE:
      return messages.DESCRIPTION_TOO_LONG(readMaximumLength(issue));
    case UNIVERSE_MODE_INVALID_CODE:
      return messages.MODE_INVALID;
    default:
      return messages.UNKNOWN;
  }
}
