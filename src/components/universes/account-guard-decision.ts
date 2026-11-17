import type { TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";
import { AUTHENTICATION_ERROR_CODE } from "@/shared/domain/error-kinds";
import { SIGNED_OUT_ACTION_REFUSAL } from "@/shared/presentation/signed-out-action-response";

/** How long the probe before a send may take before the send goes ahead without it. */
export const ACCOUNT_PROBE_TIME_LIMIT_MILLISECONDS = 5_000;

/**
 * What a tab does after asking the server which account is acting, before it sends a creation or a
 * remembered universe (FR-18, FR-32; specs/004-stored-universes/plan.md, section 5):
 * - `proceed`: it is the account the tab shows, or the probe gave no usable answer (the real call
 *   will fail by itself);
 * - `replace-document`: another account is acting now, so the tab sends nothing and starts again;
 * - `signed-out`: there is no valid session.
 */
export type AccountGuardDecision = "proceed" | "replace-document" | "signed-out";

export function decideAfterAccountProbe(
  heldAccountKey: string,
  probeOutcome: TimeLimitedOutcome<unknown>,
): AccountGuardDecision {
  switch (probeOutcome.status) {
    case "timed-out":
      return "proceed";
    case "rejected":
      return isSignedOutRefusal(probeOutcome.error) ? "signed-out" : "proceed";
    case "answered":
      return decideFromAnswer(heldAccountKey, probeOutcome.value);
  }
}

function decideFromAnswer(heldAccountKey: string, answer: unknown): AccountGuardDecision {
  if (!isRecord(answer)) return "proceed";

  if (answer.ok === true) {
    if (!isRecord(answer.value) || typeof answer.value.accountKey !== "string") return "proceed";
    return answer.value.accountKey === heldAccountKey ? "proceed" : "replace-document";
  }
  if (answer.ok === false && isRecord(answer.error) && answer.error.code === AUTHENTICATION_ERROR_CODE) {
    return "signed-out";
  }
  return "proceed";
}

function isSignedOutRefusal(error: unknown): boolean {
  return error instanceof Error && error.message === SIGNED_OUT_ACTION_REFUSAL.text;
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
}
