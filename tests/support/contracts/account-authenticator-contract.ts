import { beforeEach, describe, expect, it } from "vitest";
import type { AccountAuthenticator } from "@/modules/accounts/application/account-authenticator";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
} from "@/modules/accounts/domain/account-errors";
import { toComparableEmail } from "@/modules/accounts/domain/account-email";
import { parseNewAccount, type NewAccountInput } from "@/modules/accounts/domain/new-account";
import { parseSignInCredentials } from "@/modules/accounts/domain/sign-in-credentials";
import type { ActiveSession, SessionReader } from "@/shared/application/session-reader";
import {
  VALID_EMAIL_BOUNDARY_EXAMPLES,
  VALID_EMAIL_EXAMPLES,
} from "../account-email-examples";

/** An account as stored, without anything that could be a password. */
export type StoredAccountSummary = {
  readonly userId: string;
  readonly displayName: string;
  readonly email: string;
};

/**
 * What an implementation must give the shared scenarios. A "device" is whoever holds a session
 * token (the cookie of a browser): the port and the session reader always act for the device
 * that is current, and `holdSessionToken` switches device.
 */
export type AccountAuthenticatorWorld = {
  readonly accountAuthenticator: AccountAuthenticator;
  readonly sessionReader: SessionReader;
  /** The session token the current device holds, or `null` when it holds none. */
  getCurrentSessionToken(): string | null;
  /** Makes the current device hold this token (or none), as when a cookie is restored or cleared. */
  holdSessionToken(sessionToken: string | null): void;
  readAccountByEmail(comparableEmail: string): Promise<StoredAccountSummary | null>;
  countAccounts(): Promise<number>;
  /** Moves the clock the implementation reads. Used by the session lifetime scenarios. */
  setTime(time: Date): void;
};

const DEFAULT_DISPLAY_NAME = "Ana Torres";
const DEFAULT_EMAIL = "ana@example.com";
const DEFAULT_PASSWORD = "correct horse";

type TypedSignUp = Partial<Pick<NewAccountInput, "displayName" | "email" | "password">>;

/** Registers through the domain rules, as the sign-up use case does before calling the port. */
export async function registerAccount(
  world: AccountAuthenticatorWorld,
  typedSignUp: TypedSignUp = {},
): Promise<void> {
  const password = typedSignUp.password ?? DEFAULT_PASSWORD;
  const newAccount = parseNewAccount({
    displayName: typedSignUp.displayName ?? DEFAULT_DISPLAY_NAME,
    email: typedSignUp.email ?? DEFAULT_EMAIL,
    password,
    repeatPassword: password,
  });
  await world.accountAuthenticator.registerAndSignIn(newAccount);
}

/** Signs in through the domain rules, as the sign-in use case does before calling the port. */
export async function signInWithPassword(
  world: AccountAuthenticatorWorld,
  typedEmail: string,
  typedPassword: string,
): Promise<void> {
  const credentials = parseSignInCredentials({ email: typedEmail, password: typedPassword });
  await world.accountAuthenticator.signInWithPassword(credentials);
}

/** Signs in on a new device (one that holds no session) and returns the token it now holds. */
export async function signInAs(
  world: AccountAuthenticatorWorld,
  typedEmail: string,
  typedPassword: string,
): Promise<string> {
  world.holdSessionToken(null);
  await signInWithPassword(world, typedEmail, typedPassword);
  const sessionToken = world.getCurrentSessionToken();
  if (sessionToken === null) {
    throw new Error("Signing in did not leave a session token on the device.");
  }
  return sessionToken;
}

/** Reads the session a token stands for, then puts the current device back as it was. */
export async function readSessionWith(
  world: AccountAuthenticatorWorld,
  sessionToken: string | null,
): Promise<ActiveSession | null> {
  const previousSessionToken = world.getCurrentSessionToken();
  world.holdSessionToken(sessionToken);
  try {
    return await world.sessionReader.readActiveSession();
  } finally {
    world.holdSessionToken(previousSessionToken);
  }
}

/** The active session a stored account must read as: its identifier, display name and email, nothing else. */
function activeSessionOf(storedAccount: StoredAccountSummary): ActiveSession {
  return {
    userId: storedAccount.userId,
    displayName: storedAccount.displayName,
    email: storedAccount.email,
  };
}

function describeEmailForTestName(email: string): string {
  return email.length > 60 ? `an email of ${email.length} characters` : email;
}

async function captureFailure(work: () => Promise<unknown>): Promise<unknown> {
  return work().then(
    () => {
      throw new Error("Expected the operation to fail, but it succeeded.");
    },
    (failure: unknown) => failure,
  );
}

async function captureInvalidCredentialsFailure(
  work: () => Promise<unknown>,
): Promise<InvalidCredentialsError> {
  const failure = await captureFailure(work);
  if (!(failure instanceof InvalidCredentialsError)) {
    throw new Error("Expected an InvalidCredentialsError.", { cause: failure });
  }
  return failure;
}

async function readStoredAccount(
  world: AccountAuthenticatorWorld,
  comparableEmail: string,
): Promise<StoredAccountSummary> {
  const storedAccount = await world.readAccountByEmail(comparableEmail);
  if (storedAccount === null) {
    throw new Error(`Expected an account stored for ${comparableEmail}.`);
  }
  return storedAccount;
}

/**
 * The scenarios every implementation of `AccountAuthenticator` must pass unchanged (NFR-2).
 * `createWorld` is called before each scenario and must give a world with no accounts and no
 * sessions.
 */
export function describeAccountAuthenticatorContract(
  implementationName: string,
  createWorld: () => Promise<AccountAuthenticatorWorld> | AccountAuthenticatorWorld,
): void {
  describe(`account authenticator contract: ${implementationName}`, () => {
    let world: AccountAuthenticatorWorld;

    beforeEach(async () => {
      world = await createWorld();
    });

    describe("sign-up", () => {
      it("creates exactly one account", async () => {
        await registerAccount(world);

        expect(await world.countAccounts()).toBe(1);
        expect(await world.readAccountByEmail(DEFAULT_EMAIL)).not.toBeNull();
      });

      it("starts a session for the new account without asking for the password again", async () => {
        await registerAccount(world);

        const storedAccount = await readStoredAccount(world, DEFAULT_EMAIL);
        const sessionToken = world.getCurrentSessionToken();
        expect(sessionToken).not.toBeNull();
        expect(await readSessionWith(world, sessionToken)).toEqual(activeSessionOf(storedAccount));
        expect(await world.sessionReader.readActiveSession()).toEqual(activeSessionOf(storedAccount));
      });

      it("stores the comparable form of the email", async () => {
        await registerAccount(world, { email: " Ana@Example.COM " });

        expect(await world.readAccountByEmail("ana@example.com")).toMatchObject({
          email: "ana@example.com",
        });
      });

      // NFR-1, FR-5: the rule of the domain and the check of the implementation must not drift
      // apart. On the real engine this proves its own email check accepts every address the
      // domain accepts, so a sign-up never ends as an internal failure because of the email.
      it.each(
        [...VALID_EMAIL_EXAMPLES, ...VALID_EMAIL_BOUNDARY_EXAMPLES].map(
          (validEmail): [string, string] => [describeEmailForTestName(validEmail), validEmail],
        ),
      )("accepts the email the domain accepts: %s", async (_label, validEmail) => {
        const comparableEmail = toComparableEmail(validEmail);

        await registerAccount(world, { email: validEmail });

        expect(await world.countAccounts()).toBe(1);
        expect(await world.readAccountByEmail(comparableEmail)).toMatchObject({
          email: comparableEmail,
        });
        expect(world.getCurrentSessionToken()).not.toBeNull();
      });

      it("stores the display name without its surrounding whitespace and keeps the inner one", async () => {
        await registerAccount(world, { displayName: "  Ana   María  " });

        const storedAccount = await readStoredAccount(world, DEFAULT_EMAIL);
        expect(storedAccount.displayName).toBe("Ana   María");
      });

      it.each([
        ["the same email", "ana@example.com"],
        ["the same email in other case", "ANA@Example.com"],
        ["the same email with surrounding spaces", "  ana@example.com  "],
      ])("rejects %s as already registered, creates nothing and starts no session", async (_label, typedEmail) => {
        await registerAccount(world);
        world.holdSessionToken(null);

        const failure = await captureFailure(() => registerAccount(world, { email: typedEmail }));

        expect(failure).toBeInstanceOf(EmailAlreadyRegisteredError);
        expect(await world.countAccounts()).toBe(1);
        expect(world.getCurrentSessionToken()).toBeNull();
      });
    });

    describe("sign-in", () => {
      it("starts a session for the account when the password is right", async () => {
        await registerAccount(world);
        const storedAccount = await readStoredAccount(world, DEFAULT_EMAIL);

        const sessionToken = await signInAs(world, DEFAULT_EMAIL, DEFAULT_PASSWORD);

        expect(await readSessionWith(world, sessionToken)).toEqual(activeSessionOf(storedAccount));
      });

      it("finds the account whatever the case and the surrounding spaces of the typed email", async () => {
        await registerAccount(world);
        const storedAccount = await readStoredAccount(world, DEFAULT_EMAIL);

        const sessionToken = await signInAs(world, "  ANA@example.com ", DEFAULT_PASSWORD);

        expect(await readSessionWith(world, sessionToken)).toEqual(activeSessionOf(storedAccount));
      });

      it("answers a wrong password and an unknown email with the same error and starts no session", async () => {
        await registerAccount(world);
        world.holdSessionToken(null);

        const wrongPasswordFailure = await captureInvalidCredentialsFailure(() =>
          signInWithPassword(world, DEFAULT_EMAIL, "not the password"),
        );
        const unknownEmailFailure = await captureInvalidCredentialsFailure(() =>
          signInWithPassword(world, "nobody@example.com", DEFAULT_PASSWORD),
        );

        expect(wrongPasswordFailure.code).toBe(unknownEmailFailure.code);
        expect(wrongPasswordFailure.message).toBe(unknownEmailFailure.message);
        expect(world.getCurrentSessionToken()).toBeNull();
      });

      it("treats surrounding spaces of the password as part of it", async () => {
        await registerAccount(world, { password: "  spaced password  " });
        world.holdSessionToken(null);

        const failure = await captureFailure(() =>
          signInWithPassword(world, DEFAULT_EMAIL, "spaced password"),
        );

        expect(failure).toBeInstanceOf(InvalidCredentialsError);
        await expect(signInAs(world, DEFAULT_EMAIL, "  spaced password  ")).resolves.toEqual(
          expect.any(String),
        );
      });

      it("treats a composed accent and a decomposed accent as different passwords", async () => {
        const composedPassword = "contraseña-á";
        const decomposedPassword = "contraseña-á";
        await registerAccount(world, { password: composedPassword });
        world.holdSessionToken(null);

        const decomposedFailure = await captureFailure(() =>
          signInWithPassword(world, DEFAULT_EMAIL, decomposedPassword),
        );

        expect(decomposedFailure).toBeInstanceOf(InvalidCredentialsError);
        await expect(signInAs(world, DEFAULT_EMAIL, composedPassword)).resolves.toEqual(
          expect.any(String),
        );
      });

      it("keeps a decomposed password distinct from its composed form too", async () => {
        const composedPassword = "contraseña-á";
        const decomposedPassword = "contraseña-á";
        await registerAccount(world, { password: decomposedPassword });
        world.holdSessionToken(null);

        const composedFailure = await captureFailure(() =>
          signInWithPassword(world, DEFAULT_EMAIL, composedPassword),
        );

        expect(composedFailure).toBeInstanceOf(InvalidCredentialsError);
        await expect(signInAs(world, DEFAULT_EMAIL, decomposedPassword)).resolves.toEqual(
          expect.any(String),
        );
      });
    });

    describe("sign-out", () => {
      it("ends the session of the device in use and the old session is rejected", async () => {
        await registerAccount(world);
        const sessionToken = world.getCurrentSessionToken();

        await world.accountAuthenticator.signOutCurrentSession();

        expect(await readSessionWith(world, sessionToken)).toBeNull();
        expect(await world.sessionReader.readActiveSession()).toBeNull();
      });

      it("ends only the session of the device in use and leaves the other devices signed in", async () => {
        await registerAccount(world);
        const storedAccount = await readStoredAccount(world, DEFAULT_EMAIL);
        const firstDeviceToken = world.getCurrentSessionToken();
        const secondDeviceToken = await signInAs(world, DEFAULT_EMAIL, DEFAULT_PASSWORD);

        world.holdSessionToken(firstDeviceToken);
        await world.accountAuthenticator.signOutCurrentSession();

        expect(await readSessionWith(world, firstDeviceToken)).toBeNull();
        expect(await readSessionWith(world, secondDeviceToken)).toEqual(activeSessionOf(storedAccount));
      });

      it("succeeds when invoked twice in a row", async () => {
        await registerAccount(world);

        await world.accountAuthenticator.signOutCurrentSession();

        await expect(world.accountAuthenticator.signOutCurrentSession()).resolves.toBeUndefined();
      });

      it("succeeds when the device holds no session", async () => {
        await expect(world.accountAuthenticator.signOutCurrentSession()).resolves.toBeUndefined();
      });

      it("succeeds when the session it holds was already ended from another device", async () => {
        await registerAccount(world);
        const staleSessionToken = world.getCurrentSessionToken();
        await world.accountAuthenticator.signOutCurrentSession();

        world.holdSessionToken(staleSessionToken);

        await expect(world.accountAuthenticator.signOutCurrentSession()).resolves.toBeUndefined();
      });
    });

    describe("session lifetime", () => {
      // The numbers are written out here on purpose, apart from the session policy of the
      // application: this is the independent check of FR-23 to FR-25.
      const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
      const THIRTY_DAYS_IN_MILLISECONDS = 30 * ONE_DAY_IN_MILLISECONDS;
      const SIGN_UP_TIME = new Date("2026-03-01T12:00:00.000Z");

      function timeAfterSignUp(milliseconds: number): Date {
        return new Date(SIGN_UP_TIME.getTime() + milliseconds);
      }

      let signedUpAccount: StoredAccountSummary;

      beforeEach(async () => {
        world.setTime(SIGN_UP_TIME);
        await registerAccount(world);
        signedUpAccount = await readStoredAccount(world, DEFAULT_EMAIL);
      });

      it("keeps a session unused for exactly 30 days valid (FR-24)", async () => {
        world.setTime(timeAfterSignUp(THIRTY_DAYS_IN_MILLISECONDS));

        expect(await world.sessionReader.readActiveSession()).toEqual(activeSessionOf(signedUpAccount));
      });

      it("treats a session unused for 30 days plus 1 millisecond as signed out (FR-24)", async () => {
        world.setTime(timeAfterSignUp(THIRTY_DAYS_IN_MILLISECONDS + 1));

        expect(await world.sessionReader.readActiveSession()).toBeNull();
      });

      it("keeps a session valid for 400 simulated days when it is used every day (FR-25)", async () => {
        for (let dayNumber = 1; dayNumber <= 400; dayNumber += 1) {
          world.setTime(timeAfterSignUp(dayNumber * ONE_DAY_IN_MILLISECONDS));

          expect(await world.sessionReader.readActiveSession()).toEqual(activeSessionOf(signedUpAccount));
        }
      }, 60_000);

      it("does not move the expiry when the session is used less than 24 hours after its last renewal (FR-23)", async () => {
        world.setTime(timeAfterSignUp(ONE_DAY_IN_MILLISECONDS - 1));
        expect(await world.sessionReader.readActiveSession()).toEqual(activeSessionOf(signedUpAccount));

        // Had the use above extended the session, it would still be valid one millisecond after the original expiry.
        world.setTime(timeAfterSignUp(THIRTY_DAYS_IN_MILLISECONDS + 1));

        expect(await world.sessionReader.readActiveSession()).toBeNull();
      });

      it("extends the expiry to 30 days from the moment of a use at 24 hours (FR-23)", async () => {
        world.setTime(timeAfterSignUp(ONE_DAY_IN_MILLISECONDS));
        expect(await world.sessionReader.readActiveSession()).toEqual(activeSessionOf(signedUpAccount));

        world.setTime(timeAfterSignUp(ONE_DAY_IN_MILLISECONDS + THIRTY_DAYS_IN_MILLISECONDS));

        expect(await world.sessionReader.readActiveSession()).toEqual(activeSessionOf(signedUpAccount));
      });

      it("ends the extended session 1 millisecond after its new expiry (FR-23, FR-24)", async () => {
        world.setTime(timeAfterSignUp(ONE_DAY_IN_MILLISECONDS));
        expect(await world.sessionReader.readActiveSession()).toEqual(activeSessionOf(signedUpAccount));

        world.setTime(timeAfterSignUp(ONE_DAY_IN_MILLISECONDS + THIRTY_DAYS_IN_MILLISECONDS + 1));

        expect(await world.sessionReader.readActiveSession()).toBeNull();
      });
    });

    describe("a session that is not valid reads as no session (FR-26)", () => {
      function alterCharacterAt(text: string, position: number): string {
        const replacement = text[position] === "A" ? "B" : "A";
        return `${text.slice(0, position)}${replacement}${text.slice(position + 1)}`;
      }

      it("reads no session when the device holds no token", async () => {
        await registerAccount(world);

        expect(await readSessionWith(world, null)).toBeNull();
      });

      it("reads no session for a token that was never issued", async () => {
        await registerAccount(world);

        expect(await readSessionWith(world, "a-token-that-was-never-issued")).toBeNull();
      });

      it("reads no session for a token whose session was deleted by a sign-out", async () => {
        await registerAccount(world);
        const sessionToken = world.getCurrentSessionToken();
        await world.accountAuthenticator.signOutCurrentSession();

        expect(await readSessionWith(world, sessionToken)).toBeNull();
      });

      it("reads no session for a token that was altered at its start or at its end", async () => {
        await registerAccount(world);
        const sessionToken = world.getCurrentSessionToken();
        if (sessionToken === null) {
          throw new Error("Signing up did not leave a session token on the device.");
        }

        expect(await readSessionWith(world, alterCharacterAt(sessionToken, 0))).toBeNull();
        expect(
          await readSessionWith(world, alterCharacterAt(sessionToken, sessionToken.length - 1)),
        ).toBeNull();
        expect(await readSessionWith(world, sessionToken)).not.toBeNull();
      });
    });
  });
}
