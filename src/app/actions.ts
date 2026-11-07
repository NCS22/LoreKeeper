"use server";

import { headers } from "next/headers";
import { createAccountsModule } from "@/modules/accounts";
import { assertSameSiteRequest } from "@/shared/presentation/assert-same-site-request";
import { runAction } from "@/shared/presentation/run-action";

/** Ends the session in use. It succeeds, with `null`, also when there is no valid session. */
export async function signOutAction() {
  return runAction(async () => {
    assertSameSiteRequest(await headers());
    await createAccountsModule().signOut();
    return null;
  });
}
