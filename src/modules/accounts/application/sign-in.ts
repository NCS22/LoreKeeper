import type { SessionReader } from "@/shared/application/session-reader";
import { parseSignInCredentials, type SignInInput } from "../domain/sign-in-credentials";
import type { AccountAuthenticator } from "./account-authenticator";

export type SignInDependencies = {
  readonly accountAuthenticator: AccountAuthenticator;
  readonly sessionReader: SessionReader;
};

/** Input exactly as it arrives from the form; every rule is applied by the use case. */
export type SignInCommand = SignInInput;

export type SignInResult = { readonly status: "signed-in" | "already-signed-in" };

/**
 * Starts a session for the account that matches the email and the password. A request that
 * already has a valid session gets `already-signed-in` and nothing else happens (FR-19).
 * Otherwise only an empty email or an empty password is rejected before the credential check
 * (FR-15); any other wrong value gets the same answer as an unknown email.
 *
 * Throws `ValidationError`, `InvalidCredentialsError` or `InfrastructureError`.
 */
export async function signIn(
  dependencies: SignInDependencies,
  command: SignInCommand,
): Promise<SignInResult> {
  const activeSession = await dependencies.sessionReader.readActiveSession();
  if (activeSession !== null) {
    return { status: "already-signed-in" };
  }

  const credentials = parseSignInCredentials(command);
  await dependencies.accountAuthenticator.signInWithPassword(credentials);

  return { status: "signed-in" };
}
