import { requireActingUser } from "@/shared/application/require-acting-user";
import type { ActingUser } from "@/shared/domain/acting-user";
import { requestSessionReader } from "@/shared/infrastructure/request-session-reader";

/**
 * The single entry every Server Action and Route Handler uses to know who is acting. The account
 * comes only from the session of the request being served (FR-20, FR-21). Throws
 * `AuthenticationError` when there is no valid session and `InfrastructureError` when the session
 * cannot be checked (FR-22).
 */
export function getActingUser(): Promise<ActingUser> {
  return requireActingUser({ sessionReader: requestSessionReader });
}
