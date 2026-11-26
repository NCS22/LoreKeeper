"use server";

import { headers } from "next/headers";
import { createKnowledgeModule } from "@/modules/knowledge";
import { assertSameSiteRequest } from "@/shared/presentation/assert-same-site-request";
import { getActingUser } from "@/shared/presentation/get-acting-user";
import { parseActionInput } from "@/shared/presentation/parse-action-input";
import { runAction } from "@/shared/presentation/run-action";
import { createWorkInputSchema } from "./create-work-input-schema";
import { loadUniverseKnowledgeInputSchema } from "./load-universe-knowledge-input-schema";

// Every action reads the acting user before it parses the input: a person without a session gets
// the authentication error and learns nothing about validation. The universe must be an own
// universe of that user; anything else answers the same not found (FR-11).

/** Creates a work with its units in an own universe of the acting account. Input arrives untyped. */
export async function createWorkAction(input: unknown) {
  return runAction(async () => {
    assertSameSiteRequest(await headers());
    const actor = await getActingUser();
    const createWorkCommand = parseActionInput(createWorkInputSchema, input);
    return { work: await createKnowledgeModule().createWork(actor, createWorkCommand) };
  });
}

/** Reads what the workspace shows of an own universe of the acting account: today, its works. */
export async function loadUniverseKnowledgeAction(input: unknown) {
  return runAction(async () => {
    assertSameSiteRequest(await headers());
    const actor = await getActingUser();
    const { universeId } = parseActionInput(loadUniverseKnowledgeInputSchema, input);
    return createKnowledgeModule().loadUniverseKnowledge(actor, universeId);
  });
}
