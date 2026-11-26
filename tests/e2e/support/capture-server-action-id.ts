import type { Page } from "@playwright/test";
import { isCallOfServerAction, type ServerActionName } from "./server-action-ids";

// A Server Action is called by its identifier (the `next-action` header), which the production build
// generates. To replay a call without a browser page (a forged call, a call with another account's
// identifier), a test reads the identifier from a real call the page makes (plan D12). The calls are
// recognized by the identifier of their action in the build, not by their body: remembering a universe
// and loading its knowledge send the same body (spec 006, decision D-T5-2).

export type UniverseActionKind = "create-universe" | "check-name" | "remember-universe";

const ACTION_NAME_BY_KIND: Readonly<Record<UniverseActionKind, ServerActionName>> = {
  "create-universe": "createUniverseAction",
  "check-name": "isUniverseNameInUseAction",
  "remember-universe": "rememberUniverseAction",
};

/**
 * Starts listening for the next call of the action and resolves with its identifier. Start it BEFORE
 * the step that makes the call, and await it after: `const id = captureServerActionId(page, kind)`.
 */
export async function captureServerActionId(page: Page, actionKind: UniverseActionKind): Promise<string> {
  const request = await page.waitForRequest((candidate) => isCallOfServerAction(candidate, ACTION_NAME_BY_KIND[actionKind]));
  const actionId = request.headers()["next-action"];
  if (actionId === undefined) {
    throw new Error("The captured call carries no action identifier.");
  }
  return actionId;
}
