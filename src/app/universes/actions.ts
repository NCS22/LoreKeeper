"use server";

import { headers } from "next/headers";
import { createUniversesModule } from "@/modules/universes";
import { NOT_FOUND_ERROR_CODE, NotFoundError } from "@/shared/domain/error-kinds";
import { VALIDATION_ERROR_CODE, ValidationError } from "@/shared/domain/validation-error";
import { logServerError } from "@/shared/infrastructure/server-error-logger";
import { assertSameSiteRequest } from "@/shared/presentation/assert-same-site-request";
import { getActingUser } from "@/shared/presentation/get-acting-user";
import { parseActionInput } from "@/shared/presentation/parse-action-input";
import { runAction } from "@/shared/presentation/run-action";
import { createUniverseInputSchema } from "./create-universe-input-schema";
import { editUniverseInputSchema } from "./edit-universe-input-schema";
import { isUniverseNameInUseInputSchema } from "./is-universe-name-in-use-input-schema";
import { rememberUniverseInputSchema } from "./remember-universe-input-schema";

// Every action reads the acting user before it parses the input: a person without a session gets
// the authentication error and learns nothing about validation (FR-32). The owner of anything
// stored is that user, never a value from the input (FR-2).

/** Creates an empty universe owned by the acting account. Input arrives untyped from the client. */
export async function createUniverseAction(input: unknown) {
  return runAction(async () => {
    assertSameSiteRequest(await headers());
    const actor = await getActingUser();
    const createUniverseCommand = parseActionInput(createUniverseInputSchema, input);
    return { universe: await createUniversesModule().createUniverse(actor, createUniverseCommand) };
  });
}

/**
 * Changes the name and the description of an own universe of the acting account. Input arrives
 * untyped from the client; the use case checks the identifier, the ownership, the fields and
 * whether there is a real change, in that order (spec 007a FR-9).
 */
export async function editUniverseAction(input: unknown) {
  return runAction(async () => {
    assertSameSiteRequest(await headers());
    const actor = await getActingUser();
    const editUniverseCommand = parseActionInput(editUniverseInputSchema, input);
    return { universe: await createUniversesModule().editUniverse(actor, editUniverseCommand) };
  });
}

/**
 * Tells whether the acting account already has a universe with this name, leaving out the
 * universe being edited when its identifier is given. Never blocks creation or editing.
 */
export async function isUniverseNameInUseAction(input: unknown) {
  return runAction(async () => {
    assertSameSiteRequest(await headers());
    const actor = await getActingUser();
    const { name, excludedUniverseId } = parseActionInput(isUniverseNameInUseInputSchema, input);
    return {
      isInUse: await createUniversesModule().isUniverseNameInUse(actor, name, excludedUniverseId),
    };
  });
}

/**
 * Remembers one of the own universes as the one to select first next time. A malformed, foreign or
 * nonexistent identifier is logged here (FR-30); infrastructure failures are logged by the mapper.
 */
export async function rememberUniverseAction(input: unknown) {
  return runAction(async () => {
    assertSameSiteRequest(await headers());
    const actor = await getActingUser();
    try {
      const rememberUniverseCommand = parseActionInput(rememberUniverseInputSchema, input);
      await createUniversesModule().rememberUniverse(actor, rememberUniverseCommand);
      return null;
    } catch (failure) {
      logRefusedIdentifier(failure);
      throw failure;
    }
  });
}

/**
 * Gives the identifier of the account that acts, derived from the session on the server. The tab
 * compares it with the one it started with to notice an account change in another tab (FR-18). The
 * server never takes an account from the client.
 */
export async function confirmAccountAction() {
  return runAction(async () => {
    assertSameSiteRequest(await headers());
    const actor = await getActingUser();
    return { accountKey: actor.userId };
  });
}

function logRefusedIdentifier(failure: unknown): void {
  if (failure instanceof ValidationError) {
    logServerError(failure, { errorCode: VALIDATION_ERROR_CODE });
  } else if (failure instanceof NotFoundError) {
    logServerError(failure, { errorCode: NOT_FOUND_ERROR_CODE });
  }
}
