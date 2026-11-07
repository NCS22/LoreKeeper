import { DomainError } from "@/shared/domain/domain-error";

// The error kinds of the system, each with one stable code. `ValidationError` (validation-error.ts)
// is the sixth kind. There is no authorization class on purpose: that kind stays reserved until
// sharing exists (OD-12), and nothing produces it in this version.

export const AUTHENTICATION_ERROR_CODE = "AUTHENTICATION_ERROR";
export const NOT_FOUND_ERROR_CODE = "NOT_FOUND";
export const BUSINESS_RULE_VIOLATION_ERROR_CODE = "BUSINESS_RULE_VIOLATION";
export const INFRASTRUCTURE_ERROR_CODE = "INFRASTRUCTURE_ERROR";
export const EXTERNAL_PROVIDER_ERROR_CODE = "EXTERNAL_PROVIDER_ERROR";

type ErrorOptions = { readonly cause?: unknown };

/** The person is not signed in, or the credentials do not match an account. */
export class AuthenticationError extends DomainError {
  readonly code = AUTHENTICATION_ERROR_CODE;
}

/** The resource does not exist or belongs to another user; both cases look the same. */
export class NotFoundError extends DomainError {
  readonly code = NOT_FOUND_ERROR_CODE;
}

/** A well-formed request that breaks a rule of the business (for example a duplicate email). */
export class BusinessRuleViolationError extends DomainError {
  readonly code = BUSINESS_RULE_VIOLATION_ERROR_CODE;
}

/**
 * Something outside the business rules failed (database, configuration, a library).
 * The message is generic and safe to log; the original failure travels in `cause`.
 */
export class InfrastructureError extends DomainError {
  readonly code = INFRASTRUCTURE_ERROR_CODE;

  constructor(message: string, options?: ErrorOptions) {
    super(message);
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/** An external provider (for example an AI provider) failed. The original failure travels in `cause`. */
export class ExternalProviderError extends DomainError {
  readonly code = EXTERNAL_PROVIDER_ERROR_CODE;

  constructor(message: string, options?: ErrorOptions) {
    super(message);
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}
