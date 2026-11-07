import { unstable_rethrow } from "next/navigation";
import type { ActionResult } from "@/shared/presentation/action-result";
import { mapErrorToResponse } from "@/shared/presentation/map-error-to-response";

/**
 * Runs the work of a Server Action and returns its result in the one shape every action uses.
 * Any error goes through the one mapper, except the framework's own control-flow errors
 * (redirect, not found, dynamic rendering), which are rethrown so Next.js can handle them.
 */
export async function runAction<Value>(work: () => Promise<Value>): Promise<ActionResult<Value>> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: mapErrorToResponse(error).body };
  }
}
