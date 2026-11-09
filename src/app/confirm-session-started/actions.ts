"use server";

import { headers } from "next/headers";
import { assertSameSiteRequest } from "@/shared/presentation/assert-same-site-request";
import { getActingUser } from "@/shared/presentation/get-acting-user";
import { runAction } from "@/shared/presentation/run-action";

/**
 * Confirms that the browser sent back the session that a sign-up or sign-in just started. It only
 * reads: it succeeds with `null` when the request carries a valid session and fails with the
 * authentication error when it does not, which the forms read as "this browser does not keep the
 * session" (FR-14). It changes nothing and takes no input.
 */
export async function confirmSessionStartedAction() {
  return runAction(async () => {
    assertSameSiteRequest(await headers());
    await getActingUser();
    return null;
  });
}
