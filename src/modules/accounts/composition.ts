import {
  readCurrentRequestHeaders,
  requestSessionReader,
} from "@/shared/infrastructure/request-session-reader";
import { getBetterAuthInstance } from "@/shared/infrastructure/better-auth-instance";
import { signIn, type SignInCommand, type SignInResult } from "./application/sign-in";
import { signOut } from "./application/sign-out";
import { signUp, type SignUpCommand, type SignUpResult } from "./application/sign-up";
import { createBetterAuthAccountAuthenticator } from "./infrastructure/better-auth-account-authenticator";

/** The use cases of the module, already bound to Better Auth over PostgreSQL and to the session of the request. */
export type AccountsModule = {
  readonly signUp: (command: SignUpCommand) => Promise<SignUpResult>;
  readonly signIn: (command: SignInCommand) => Promise<SignInResult>;
  readonly signOut: () => Promise<void>;
};

/**
 * Wires the three use cases. Creating the module touches nothing: the environment, the Prisma
 * client and the library instance are built the first time a use case needs them, so importing
 * this file and calling this function work without a database or a `.env`.
 */
export function createAccountsModule(): AccountsModule {
  const accountAuthenticator = createBetterAuthAccountAuthenticator({
    getBetterAuthInstance,
    getRequestHeaders: readCurrentRequestHeaders,
  });
  const sessionReader = requestSessionReader;

  return {
    signUp: (command) => signUp({ accountAuthenticator, sessionReader }, command),
    signIn: (command) => signIn({ accountAuthenticator, sessionReader }, command),
    signOut: () => signOut({ accountAuthenticator }),
  };
}
