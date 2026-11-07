import { DomainError } from "@/shared/domain/domain-error";

export const VALIDATION_ERROR_CODE = "VALIDATION_ERROR";

/**
 * One rejected field. `code` is stable; `maximumLength` (and `minimumLength`, when the rule has a
 * lower limit too) are set when the rule is a length limit.
 */
export type ValidationIssue = {
  readonly field: string;
  readonly code: string;
  readonly minimumLength?: number;
  readonly maximumLength?: number;
};

/** Thrown when input breaks one or more rules; it lists every failing field together. */
export class ValidationError extends DomainError {
  readonly code = VALIDATION_ERROR_CODE;
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(`Validation failed for: ${issues.map((issue) => issue.field).join(", ")}`);
    this.issues = issues;
  }
}
