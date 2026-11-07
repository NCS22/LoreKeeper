import type { SessionReader } from "@/shared/application/session-reader";
import { parseNewAccount, type NewAccountInput } from "../domain/new-account";
import type { AccountAuthenticator } from "./account-authenticator";

export type SignUpDependencies = {
  readonly accountAuthenticator: AccountAuthenticator;
  readonly sessionReader: SessionReader;
};

/** Input exactly as it arrives from the form; every rule is applied by the use case. */
export type SignUpCommand = NewAccountInput;

export type SignUpResult = { readonly status: "signed-up" | "already-signed-in" };

/**
 * Creates an account and starts its session. A request that already has a valid session gets
 * `already-signed-in` and nothing else happens: nothing is validated, created or started, and
 * the current session is left intact (FR-19). Otherwise every rule is checked together before
 * the authenticator is called (NFR-1).
 *
 * Throws `ValidationError`, `EmailAlreadyRegisteredError` or `InfrastructureError`.
 */
export async function signUp(
  dependencies: SignUpDependencies,
  command: SignUpCommand,
): Promise<SignUpResult> {
  const activeSession = await dependencies.sessionReader.readActiveSession();
  if (activeSession !== null) {
    return { status: "already-signed-in" };
  }

  const newAccount = parseNewAccount(command);
  await dependencies.accountAuthenticator.registerAndSignIn(newAccount);

  return { status: "signed-up" };
}
