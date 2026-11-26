import { en } from "@/messages/en";
import type { KnowledgeFormVocabulary } from "@/components/knowledge/knowledge-form-vocabulary";
import type { ActionFieldIssue } from "@/shared/presentation/action-result";

/**
 * Turns a validation issue of the work creation into the text shown under its field. Messages are
 * chosen by the stable issue code, which the page hands down in the vocabulary (the browser never
 * imports the knowledge module); the limits shown come from the issue, or else from the module.
 */
export function getWorkIssueMessage(issue: ActionFieldIssue, vocabulary: KnowledgeFormVocabulary): string {
  const messages = en.workCreation.issues;
  const codes = vocabulary.work.issueCodes;

  switch (issue.code) {
    case codes.titleRequired:
      return messages.TITLE_REQUIRED;
    case codes.titleTooLong:
      return messages.TITLE_TOO_LONG(issue.maximumLength ?? vocabulary.work.maximumTitleLength);
    case codes.titleInvalidCharacters:
      return messages.TITLE_INVALID_CHARACTERS;
    case codes.mediumInvalid:
      return messages.MEDIUM_INVALID;
    case codes.unitCountRequired:
      return messages.UNIT_COUNT_REQUIRED;
    case codes.unitCountInvalid:
      return messages.UNIT_COUNT_INVALID;
    case codes.unitCountOutOfRange:
      return messages.UNIT_COUNT_OUT_OF_RANGE(vocabulary.work.maximumUnitCount);
    default:
      return messages.UNKNOWN;
  }
}
