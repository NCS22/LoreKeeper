import { randomUUID } from "node:crypto";
import type { AccountAuthenticator } from "@/modules/accounts/application/account-authenticator";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
} from "@/modules/accounts/domain/account-errors";
import type { SessionReader } from "@/shared/application/session-reader";
import {
  SESSION_LIFETIME_IN_SECONDS,
  SESSION_RENEWAL_INTERVAL_IN_SECONDS,
} from "@/shared/domain/session-policy";
import type {
  AccountAuthenticatorWorld,
  StoredAccountSummary,
} from "../contracts/account-authenticator-contract";

type FakeAccount = StoredAccountSummary & {
  // Only a test double keeps the typed password. The comparison is exact, as the real engine must behave.
  readonly typedPassword: string;
};

type FakeSession = {
  readonly userId: string;
  expiresAt: Date;
};

const DEFAULT_STARTING_TIME = new Date("2026-01-01T00:00:00.000Z");

const SESSION_LIFETIME_IN_MILLISECONDS = SESSION_LIFETIME_IN_SECONDS * 1000;
const SESSION_RENEWAL_INTERVAL_IN_MILLISECONDS = SESSION_RENEWAL_INTERVAL_IN_SECONDS * 1000;

/**
 * An in-memory account engine that implements the port and the session reader over the same
 * sessions. Sessions live in a map keyed by token; the "current device" is the token held in
 * `currentSessionToken`, which stands for the cookie of the request being served.
 *
 * Its clock is injected (`setTime`). A session is valid up to and including its expiry; reading a
 * valid session after the renewal interval has passed since its last renewal moves the expiry to
 * one lifetime from that moment, as the real engine does (FR-23 to FR-25).
 */
export function createFakeAccountAuthenticatorWorld(
  startingTime: Date = DEFAULT_STARTING_TIME,
): AccountAuthenticatorWorld {
  let currentTime = startingTime;
  let currentSessionToken: string | null = null;
  const accountsByComparableEmail = new Map<string, FakeAccount>();
  const sessionsByToken = new Map<string, FakeSession>();

  function startSessionFor(account: FakeAccount): void {
    const sessionToken = randomUUID();
    sessionsByToken.set(sessionToken, {
      userId: account.userId,
      expiresAt: new Date(currentTime.getTime() + SESSION_LIFETIME_IN_MILLISECONDS),
    });
    currentSessionToken = sessionToken;
  }

  const accountAuthenticator: AccountAuthenticator = {
    async registerAndSignIn(newAccount) {
      if (accountsByComparableEmail.has(newAccount.email)) {
        throw new EmailAlreadyRegisteredError();
      }
      const account: FakeAccount = {
        userId: randomUUID(),
        displayName: newAccount.displayName,
        email: newAccount.email,
        typedPassword: newAccount.password,
      };
      accountsByComparableEmail.set(account.email, account);
      startSessionFor(account);
    },

    async signInWithPassword(credentials) {
      const account = accountsByComparableEmail.get(credentials.email);
      // One error for both causes, so the answer never says whether the email is registered.
      if (account === undefined || account.typedPassword !== credentials.password) {
        throw new InvalidCredentialsError();
      }
      startSessionFor(account);
    },

    async signOutCurrentSession() {
      if (currentSessionToken !== null) {
        sessionsByToken.delete(currentSessionToken);
      }
      currentSessionToken = null;
    },
  };

  const sessionReader: SessionReader = {
    async readActiveSession() {
      if (currentSessionToken === null) {
        return null;
      }
      const session = sessionsByToken.get(currentSessionToken);
      if (session === undefined) {
        return null;
      }
      if (session.expiresAt.getTime() < currentTime.getTime()) {
        sessionsByToken.delete(currentSessionToken);
        return null;
      }
      const lastRenewalTime = session.expiresAt.getTime() - SESSION_LIFETIME_IN_MILLISECONDS;
      if (lastRenewalTime + SESSION_RENEWAL_INTERVAL_IN_MILLISECONDS <= currentTime.getTime()) {
        session.expiresAt = new Date(currentTime.getTime() + SESSION_LIFETIME_IN_MILLISECONDS);
      }
      return { userId: session.userId };
    },
  };

  return {
    accountAuthenticator,
    sessionReader,
    getCurrentSessionToken: () => currentSessionToken,
    holdSessionToken(sessionToken) {
      currentSessionToken = sessionToken;
    },
    async readAccountByEmail(comparableEmail) {
      const account = accountsByComparableEmail.get(comparableEmail);
      if (account === undefined) {
        return null;
      }
      return { userId: account.userId, displayName: account.displayName, email: account.email };
    },
    async countAccounts() {
      return accountsByComparableEmail.size;
    },
    setTime(time) {
      currentTime = time;
    },
  };
}
