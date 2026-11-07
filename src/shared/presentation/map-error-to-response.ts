import {
  AuthenticationError,
  AUTHENTICATION_ERROR_CODE,
  BUSINESS_RULE_VIOLATION_ERROR_CODE,
  BusinessRuleViolationError,
  EXTERNAL_PROVIDER_ERROR_CODE,
  ExternalProviderError,
  INFRASTRUCTURE_ERROR_CODE,
  InfrastructureError,
  NOT_FOUND_ERROR_CODE,
  NotFoundError,
} from "@/shared/domain/error-kinds";
import {
  VALIDATION_ERROR_CODE,
  ValidationError,
  type ValidationIssue,
} from "@/shared/domain/validation-error";
import { logServerError } from "@/shared/infrastructure/server-error-logger";
import type { ActionErrorBody, ActionFieldIssue } from "@/shared/presentation/action-result";
import {
  ERROR_MESSAGE_BY_CODE,
  UNKNOWN_ERROR_CODE,
  type ErrorCode,
} from "@/shared/presentation/error-messages";

export type ErrorResponse = {
  readonly status: number;
  readonly body: ActionErrorBody;
};

/**
 * The HTTP status of each error code. Server Actions do not use it (they carry only the body in
 * their result); Route Handlers and the page guard do. Authorization (403) is reserved and has no
 * entry: nothing produces that kind in this version.
 */
export const STATUS_BY_ERROR_CODE: Readonly<Record<ErrorCode, number>> = {
  [VALIDATION_ERROR_CODE]: 400,
  [AUTHENTICATION_ERROR_CODE]: 401,
  [NOT_FOUND_ERROR_CODE]: 404,
  [BUSINESS_RULE_VIOLATION_ERROR_CODE]: 422,
  [INFRASTRUCTURE_ERROR_CODE]: 500,
  [EXTERNAL_PROVIDER_ERROR_CODE]: 502,
  [UNKNOWN_ERROR_CODE]: 500,
};

const ERROR_CODES_THAT_ARE_LOGGED: readonly ErrorCode[] = [
  INFRASTRUCTURE_ERROR_CODE,
  UNKNOWN_ERROR_CODE,
];

/**
 * The one place that turns any error into a response. The body has the stable code, the generic
 * sentence of that kind and, only for validation, the issues keyed by field. Infrastructure and
 * unknown errors are written to the server log with their cause and never reach the body.
 */
export function mapErrorToResponse(error: unknown): ErrorResponse {
  const errorCode = classifyError(error);

  if (ERROR_CODES_THAT_ARE_LOGGED.includes(errorCode)) {
    logServerError(error, { errorCode });
  }

  const message = ERROR_MESSAGE_BY_CODE[errorCode];
  const body: ActionErrorBody =
    error instanceof ValidationError
      ? { code: errorCode, message, fieldErrors: groupIssuesByField(error.issues) }
      : { code: errorCode, message };

  return { status: STATUS_BY_ERROR_CODE[errorCode], body };
}

function classifyError(error: unknown): ErrorCode {
  if (error instanceof ValidationError) return VALIDATION_ERROR_CODE;
  if (error instanceof AuthenticationError) return AUTHENTICATION_ERROR_CODE;
  if (error instanceof NotFoundError) return NOT_FOUND_ERROR_CODE;
  if (error instanceof BusinessRuleViolationError) return BUSINESS_RULE_VIOLATION_ERROR_CODE;
  if (error instanceof InfrastructureError) return INFRASTRUCTURE_ERROR_CODE;
  if (error instanceof ExternalProviderError) return EXTERNAL_PROVIDER_ERROR_CODE;
  return UNKNOWN_ERROR_CODE;
}

function groupIssuesByField(
  issues: readonly ValidationIssue[],
): Record<string, readonly ActionFieldIssue[]> {
  const issuesByField = new Map<string, ActionFieldIssue[]>();

  for (const issue of issues) {
    const issuesOfField = issuesByField.get(issue.field) ?? [];
    issuesOfField.push(toActionFieldIssue(issue));
    issuesByField.set(issue.field, issuesOfField);
  }

  return Object.fromEntries(issuesByField);
}

function toActionFieldIssue(issue: ValidationIssue): ActionFieldIssue {
  return {
    code: issue.code,
    ...(issue.minimumLength !== undefined && { minimumLength: issue.minimumLength }),
    ...(issue.maximumLength !== undefined && { maximumLength: issue.maximumLength }),
  };
}
