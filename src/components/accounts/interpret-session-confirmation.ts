import type { TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";
import { AUTHENTICATION_ERROR_CODE } from "@/shared/domain/error-kinds";

export type SessionConfirmation = "session-kept" | "session-not-kept";

/**
 * Reads the answer of the confirmation that runs right after a sign-up or sign-in succeeded
 * (FR-14, plan D7). Only an explicit authentication error means the browser did not keep the
 * session. Any other failure, a malformed answer or silence reads as "kept": the confirmation exists
 * only to avoid a redirect loop, and the page guard decides everything else on the next request.
 */
export function interpretSessionConfirmation(
  confirmationOutcome: TimeLimitedOutcome<unknown>,
): SessionConfirmation {
  if (confirmationOutcome.status !== "answered") return "session-kept";

  const answer = confirmationOutcome.value;
  if (!isRecord(answer) || answer.ok !== false) return "session-kept";

  const errorBody = answer.error;
  return isRecord(errorBody) && errorBody.code === AUTHENTICATION_ERROR_CODE
    ? "session-not-kept"
    : "session-kept";
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
}
