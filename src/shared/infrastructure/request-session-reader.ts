import { headers } from "next/headers";
import type { SessionReader } from "@/shared/application/session-reader";
import { getBetterAuthInstance } from "./better-auth-instance";
import { createBetterAuthSessionReader } from "./better-auth-session-reader";

/** The headers of the Next.js request being served (they carry the session cookie). */
export function readCurrentRequestHeaders(): Promise<Headers> {
  return headers();
}

/**
 * The session reader of the application, bound to the request being served. Creating it touches
 * nothing: the library instance, the Prisma client and the environment are only built when a
 * session is read, never at import.
 */
export const requestSessionReader: SessionReader = createBetterAuthSessionReader({
  getBetterAuthInstance,
  getRequestHeaders: readCurrentRequestHeaders,
});
