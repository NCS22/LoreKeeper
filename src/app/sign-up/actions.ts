"use server";

import { headers } from "next/headers";
import { createAccountsModule } from "@/modules/accounts";
import { assertSameSiteRequest } from "@/shared/presentation/assert-same-site-request";
import { parseActionInput } from "@/shared/presentation/parse-action-input";
import { runAction } from "@/shared/presentation/run-action";
import { signUpInputSchema } from "./sign-up-input-schema";

/** Creates an account and starts its session. Input arrives untyped from the client. */
export async function signUpAction(input: unknown) {
  return runAction(async () => {
    assertSameSiteRequest(await headers());
    const signUpCommand = parseActionInput(signUpInputSchema, input);
    return createAccountsModule().signUp(signUpCommand);
  });
}
