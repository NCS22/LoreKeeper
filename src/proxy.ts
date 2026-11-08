import type { NextRequest } from "next/server";
import { decidePageAccess } from "@/modules/accounts";
import { readSessionForGuard } from "@/shared/infrastructure/read-session-for-guard";
import { guardPageRequest } from "@/shared/presentation/page-access-guard";

// Wiring only: the access rules live in the accounts module and the glue in the shared guard.
// Nothing here reads the environment at import; the library instance is built on the first request.
export function proxy(request: NextRequest) {
  return guardPageRequest(request, {
    readSession: readSessionForGuard,
    decideAccess: decidePageAccess,
  });
}

// Every address except the three public resources, which the framework serves without a session
// (FR-21, plan D20). Each exclusion stops at a path-segment boundary, exactly as the access policy
// classifies them, so "/_next/staticfoo" still goes through the guard (decision D-T2-2).
export const config = {
  matcher: ["/((?!_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$).*)"],
};
