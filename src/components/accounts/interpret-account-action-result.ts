import { en } from "@/messages/en";
import {
  collectAccountFieldMessages,
  type AccountFieldMessages,
  type AccountFormFieldName,
  type AccountFormVocabulary,
  type AccountIssue,
} from "@/components/accounts/account-issue-messages";
import type { TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";
import {
  AUTHENTICATION_ERROR_CODE,
  BUSINESS_RULE_VIOLATION_ERROR_CODE,
} from "@/shared/domain/error-kinds";
import { VALIDATION_ERROR_CODE } from "@/shared/domain/validation-error";
import { SIGNED_OUT_ACTION_REFUSAL } from "@/shared/presentation/signed-out-action-response";

export type AccountOperation = "sign-up" | "sign-in" | "sign-out";

/** What the form or the control has to do after a submission. */
export type AccountSubmissionOutcome =
  /** The operation worked: the person moves on (a sign-in or sign-up still confirms the session first). */
  | { readonly status: "succeeded" }
  /** A valid session already existed and nothing was processed (FR-22). */
  | { readonly status: "already-signed-in" }
  /** Messages for the fields of the form (FR-4, FR-5, FR-6). */
  | { readonly status: "field-errors"; readonly messagesByField: AccountFieldMessages }
  /** One message for the general message element of the form or the menu (FR-7, FR-9, FR-10, FR-28). */
  | { readonly status: "message"; readonly message: string };

const FORM_FIELDS_BY_OPERATION: Readonly<Record<AccountOperation, readonly AccountFormFieldName[]>> = {
  "sign-up": ["displayName", "email", "password", "repeatPassword"],
  "sign-in": ["email", "password"],
  "sign-out": [],
};

const RESULT_UNKNOWN_MESSAGE_BY_OPERATION: Readonly<Record<AccountOperation, string>> = {
  "sign-up": en.accountForms.signUp.resultUnknown,
  "sign-in": en.accountForms.signIn.resultUnknown,
  "sign-out": en.accountForms.signOut.resultUnknown,
};

const SUCCESS_STATUS_BY_OPERATION: Readonly<Record<AccountOperation, string | null>> = {
  "sign-up": "signed-up",
  "sign-in": "signed-in",
  "sign-out": null,
};

const GENERAL_FAILURE_OUTCOME: AccountSubmissionOutcome = {
  status: "message",
  message: en.accountForms.generalFailure,
};

/**
 * Decides what the interface does with the end of a submission of the three account operations.
 * It never throws: a result that does not have the expected shape is read as a general failure, and
 * the answer of the page guard to a sign-out without a session is read as a success (the person is
 * already signed out). The table is section 4 of specs/003-account-screens/plan.md.
 */
export function interpretAccountActionResult(
  operation: AccountOperation,
  outcome: TimeLimitedOutcome<unknown>,
  vocabulary: AccountFormVocabulary,
): AccountSubmissionOutcome {
  switch (outcome.status) {
    case "timed-out":
      return { status: "message", message: RESULT_UNKNOWN_MESSAGE_BY_OPERATION[operation] };
    case "rejected":
      return interpretRejection(operation, outcome.error);
    case "answered":
      return interpretAnswer(operation, outcome.value, vocabulary);
  }
}

function interpretRejection(operation: AccountOperation, error: unknown): AccountSubmissionOutcome {
  if (operation === "sign-out" && isSignedOutRefusal(error)) {
    return { status: "succeeded" };
  }
  return { status: "message", message: RESULT_UNKNOWN_MESSAGE_BY_OPERATION[operation] };
}

function isSignedOutRefusal(error: unknown): boolean {
  return error instanceof Error && error.message === SIGNED_OUT_ACTION_REFUSAL.text;
}

function interpretAnswer(
  operation: AccountOperation,
  answer: unknown,
  vocabulary: AccountFormVocabulary,
): AccountSubmissionOutcome {
  if (!isRecord(answer)) return GENERAL_FAILURE_OUTCOME;
  if (answer.ok === true) return interpretSuccess(operation, answer.value);
  if (answer.ok === false) return interpretFailure(operation, answer.error, vocabulary);
  return GENERAL_FAILURE_OUTCOME;
}

function interpretSuccess(operation: AccountOperation, value: unknown): AccountSubmissionOutcome {
  const successStatus = SUCCESS_STATUS_BY_OPERATION[operation];

  if (successStatus === null) {
    return value === null ? { status: "succeeded" } : GENERAL_FAILURE_OUTCOME;
  }
  if (!isRecord(value)) return GENERAL_FAILURE_OUTCOME;
  if (value.status === successStatus) return { status: "succeeded" };
  if (value.status === "already-signed-in") return { status: "already-signed-in" };
  return GENERAL_FAILURE_OUTCOME;
}

function interpretFailure(
  operation: AccountOperation,
  errorBody: unknown,
  vocabulary: AccountFormVocabulary,
): AccountSubmissionOutcome {
  if (!isRecord(errorBody)) return GENERAL_FAILURE_OUTCOME;

  if (errorBody.code === VALIDATION_ERROR_CODE) {
    return interpretValidationFailure(operation, errorBody.fieldErrors, vocabulary);
  }
  if (errorBody.code === BUSINESS_RULE_VIOLATION_ERROR_CODE && operation === "sign-up") {
    return {
      status: "field-errors",
      messagesByField: { email: [en.accountForms.emailAlreadyRegistered] },
    };
  }
  if (errorBody.code === AUTHENTICATION_ERROR_CODE && operation === "sign-in") {
    return { status: "message", message: en.accountForms.signIn.credentialsIncorrect };
  }
  return GENERAL_FAILURE_OUTCOME;
}

function interpretValidationFailure(
  operation: AccountOperation,
  fieldErrors: unknown,
  vocabulary: AccountFormVocabulary,
): AccountSubmissionOutcome {
  const messagesByField = collectAccountFieldMessages(
    readIssuesByFieldName(fieldErrors),
    FORM_FIELDS_BY_OPERATION[operation],
    vocabulary,
  );

  // Issues that belong to no field of the form (a request from another site, an unexpected input
  // shape) leave nothing to show on a field, so the person gets the general failure (FR-9).
  return Object.keys(messagesByField).length === 0
    ? GENERAL_FAILURE_OUTCOME
    : { status: "field-errors", messagesByField };
}

function readIssuesByFieldName(fieldErrors: unknown): Record<string, readonly AccountIssue[]> {
  const issuesByFieldName: Record<string, readonly AccountIssue[]> = {};
  if (!isRecord(fieldErrors)) return issuesByFieldName;

  for (const [fieldName, issues] of Object.entries(fieldErrors)) {
    if (Array.isArray(issues)) {
      issuesByFieldName[fieldName] = issues.filter(isAccountIssue);
    }
  }
  return issuesByFieldName;
}

function isAccountIssue(candidate: unknown): candidate is AccountIssue {
  return (
    isRecord(candidate) &&
    typeof candidate.code === "string" &&
    isOptionalNumber(candidate.minimumLength) &&
    isOptionalNumber(candidate.maximumLength)
  );
}

function isOptionalNumber(candidate: unknown): boolean {
  return candidate === undefined || typeof candidate === "number";
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
}
