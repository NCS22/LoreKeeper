import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Request } from "@playwright/test";
import { isServerActionRequest } from "./server-action-requests";

// A Server Action is called by its identifier (the `next-action` header), which the production build
// generates. Two actions can send the same body (remembering a universe and loading its knowledge both
// send `{ universeId }`, spec 006), so the tests tell them apart by that identifier, read from the
// manifest the build writes next to the servers the tests run (decision D-T5-2 of spec 006). Only the
// identifiers and the exported names of the manifest are read.

const SERVER_REFERENCE_MANIFEST_PATH = join(process.cwd(), ".next", "server", "server-reference-manifest.json");

/** The Server Actions the browser tests recognize, by the name they are exported with. */
export type ServerActionName =
  | "createUniverseAction"
  | "isUniverseNameInUseAction"
  | "rememberUniverseAction"
  | "loadUniverseKnowledgeAction"
  | "createWorkAction"
  | "createEntityAction"
  | "createRelationshipAction";

type ServerReferenceManifest = {
  readonly node: Readonly<Record<string, { readonly exportedName?: string }>>;
};

let actionIdsByName: ReadonlyMap<string, readonly string[]> | null = null;

function readActionIdsByName(): ReadonlyMap<string, readonly string[]> {
  if (actionIdsByName !== null) return actionIdsByName;

  const manifest = JSON.parse(readFileSync(SERVER_REFERENCE_MANIFEST_PATH, "utf8")) as ServerReferenceManifest;
  const idsByName = new Map<string, string[]>();
  for (const [actionId, reference] of Object.entries(manifest.node)) {
    if (reference.exportedName === undefined) continue;
    idsByName.set(reference.exportedName, [...(idsByName.get(reference.exportedName) ?? []), actionId]);
  }
  actionIdsByName = idsByName;
  return idsByName;
}

/** The identifier of the action in the build the tests run; fails loudly when it is not exactly one. */
export function readServerActionId(actionName: ServerActionName): string {
  const actionIds = readActionIdsByName().get(actionName) ?? [];
  if (actionIds.length !== 1) {
    throw new Error(`Expected one identifier for ${actionName} in the build, found ${actionIds.length}.`);
  }
  return actionIds[0];
}

/** True when the request is a call of this Server Action. */
export function isCallOfServerAction(request: Request, actionName: ServerActionName): boolean {
  return isServerActionRequest(request) && request.headers()["next-action"] === readServerActionId(actionName);
}
