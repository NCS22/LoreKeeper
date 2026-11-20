import { en } from "@/messages/en";
import type { UniverseFormVocabulary } from "@/components/universes/universe-form-vocabulary";
import type { ActionFieldIssue } from "@/shared/presentation/action-result";

function readMaximumLength(issue: ActionFieldIssue): number {
  // A length rule always reports its limit; the UI never supplies one of its own (NFR-5).
  if (issue.maximumLength === undefined) {
    throw new Error(`Validation issue ${issue.code} carries no maximumLength`);
  }
  return issue.maximumLength;
}

/**
 * Turns a validation issue of universe creation into the text shown under its field.
 * Messages are chosen by the stable issue code, which the page hands down in the vocabulary (the
 * browser never imports the universes module); any limit shown comes from the issue details.
 */
export function getUniverseIssueMessage(issue: ActionFieldIssue, vocabulary: UniverseFormVocabulary): string {
  const messages = en.universeCreation.issues;
  const codes = vocabulary.issueCodes;

  switch (issue.code) {
    case codes.nameRequired:
      return messages.NAME_REQUIRED;
    case codes.nameTooLong:
      return messages.NAME_TOO_LONG(readMaximumLength(issue));
    case codes.nameInvalidCharacters:
      return messages.NAME_INVALID_CHARACTERS;
    case codes.descriptionTooLong:
      return messages.DESCRIPTION_TOO_LONG(readMaximumLength(issue));
    case codes.descriptionInvalidCharacters:
      return messages.DESCRIPTION_INVALID_CHARACTERS;
    case codes.modeInvalid:
      return messages.MODE_INVALID;
    default:
      return messages.UNKNOWN;
  }
}
