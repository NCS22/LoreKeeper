import type { Page } from "@playwright/test";
import { isServerActionRequest } from "./server-action-requests";

// A Server Action is called by its identifier (the `next-action` header), which the production build
// generates. To replay a call without a browser page (a forged call, a call with another account's
// identifier), a test reads the identifier from a real call the page makes (plan D12). The three
// universe actions are told apart by what their body carries.

export type UniverseActionKind = "create-universe" | "check-name" | "remember-universe";

function bodyBelongsTo(actionKind: UniverseActionKind, requestBody: string): boolean {
  switch (actionKind) {
    case "create-universe":
      return requestBody.includes('"mode"');
    case "check-name":
      return requestBody.startsWith('[{"name":') && !requestBody.includes('"mode"');
    case "remember-universe":
      return requestBody.includes('"universeId"');
  }
}

/**
 * Starts listening for the next call of the action and resolves with its identifier. Start it BEFORE
 * the step that makes the call, and await it after: `const id = captureServerActionId(page, kind)`.
 */
export async function captureServerActionId(page: Page, actionKind: UniverseActionKind): Promise<string> {
  const request = await page.waitForRequest(
    (candidate) => isServerActionRequest(candidate) && bodyBelongsTo(actionKind, candidate.postData() ?? ""),
  );
  const actionId = request.headers()["next-action"];
  if (actionId === undefined) {
    throw new Error("The captured call carries no action identifier.");
  }
  return actionId;
}
