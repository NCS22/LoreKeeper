import type { AccountAuthenticator } from "./account-authenticator";

export type SignOutDependencies = {
  readonly accountAuthenticator: AccountAuthenticator;
};

/**
 * Ends the session of the device in use and no other (FR-16, FR-17). It succeeds also when
 * there is no valid session to end (FR-18). Throws `InfrastructureError`.
 */
export async function signOut(dependencies: SignOutDependencies): Promise<void> {
  await dependencies.accountAuthenticator.signOutCurrentSession();
}
