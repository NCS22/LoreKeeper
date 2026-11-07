"use server";

import { headers } from "next/headers";
import { createAccountsModule } from "@/modules/accounts";
import { assertSameSiteRequest } from "@/shared/presentation/assert-same-site-request";
import { parseActionInput } from "@/shared/presentation/parse-action-input";
import { runAction } from "@/shared/presentation/run-action";
import { signInInputSchema } from "./sign-in-input-schema";

/** Starts a session for the account that matches the email and the password. Input arrives untyped from the client. */
export async function signInAction(input: unknown) {
  return runAction(async () => {
    assertSameSiteRequest(await headers());
    const signInCommand = parseActionInput(signInInputSchema, input);
    return createAccountsModule().signIn(signInCommand);
  });
}
