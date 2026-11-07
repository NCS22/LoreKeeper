import type { NewAccount } from "../domain/new-account";
import type { SignInCredentials } from "../domain/sign-in-credentials";

/**
 * Everything the accounts use cases need from the engine that keeps accounts and sessions.
 * The session of the current request is ambient (the cookie of the device in use), so no
 * method takes a session or an account identifier: nothing the caller controls can choose
 * whose session is started or ended.
 *
 * Every failure that is not named below is an `InfrastructureError`.
 */
export interface AccountAuthenticator {
  /**
   * Creates the account and starts a session for it in one step, without asking for the
   * password again. The input already passed the domain rules (comparable email, trimmed
   * display name). Throws `EmailAlreadyRegisteredError` when the email belongs to an account.
   */
  registerAndSignIn(newAccount: NewAccount): Promise<void>;

  /**
   * Starts a session for the account that matches the credentials. Throws
   * `InvalidCredentialsError` for an unknown email and for a wrong password alike.
   */
  signInWithPassword(credentials: SignInCredentials): Promise<void>;

  /**
   * Ends the session of the device in use and no other. Succeeds when there is no valid
   * session to end.
   */
  signOutCurrentSession(): Promise<void>;
}
