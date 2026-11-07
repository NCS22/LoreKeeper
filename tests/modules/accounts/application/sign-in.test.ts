import { describe, expect, it, vi } from "vitest";
import { signIn } from "@/modules/accounts/application/sign-in";
import { signUp } from "@/modules/accounts/application/sign-up";
import { InvalidCredentialsError } from "@/modules/accounts/domain/account-errors";
import type { SessionReader } from "@/shared/application/session-reader";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import { ValidationError } from "@/shared/domain/validation-error";
import { createFakeAccountAuthenticatorWorld } from "../../../support/fakes/fake-account-authenticator";

const EMAIL = "ana@example.com";
const PASSWORD = "correct horse";

async function createSignInSetup() {
  const world = createFakeAccountAuthenticatorWorld();
  const dependencies = {
    accountAuthenticator: world.accountAuthenticator,
    sessionReader: world.sessionReader,
  };
  await signUp(dependencies, {
    displayName: "Ana Torres",
    email: EMAIL,
    password: PASSWORD,
    repeatPassword: PASSWORD,
  });
  world.holdSessionToken(null);
  const signInWithPassword = vi.spyOn(world.accountAuthenticator, "signInWithPassword");
  return { world, signInWithPassword, dependencies };
}

describe("signIn", () => {
  it("starts a session for the account with the right password", async () => {
    const { world, dependencies } = await createSignInSetup();

    const result = await signIn(dependencies, { email: EMAIL, password: PASSWORD });

    expect(result).toEqual({ status: "signed-in" });
    expect(await world.sessionReader.readActiveSession()).not.toBeNull();
  });

  it("finds the account whatever the case and the surrounding spaces of the typed email", async () => {
    const { world, signInWithPassword, dependencies } = await createSignInSetup();

    await signIn(dependencies, { email: "  ANA@Example.com ", password: PASSWORD });

    expect(signInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
    expect(await world.sessionReader.readActiveSession()).not.toBeNull();
  });

  it("answers a wrong password and an unknown email with the same error and starts no session", async () => {
    const { world, dependencies } = await createSignInSetup();

    const wrongPasswordFailure = await signIn(dependencies, {
      email: EMAIL,
      password: "not the password",
    }).catch((error: unknown) => error);
    const unknownEmailFailure = await signIn(dependencies, {
      email: "nobody@example.com",
      password: PASSWORD,
    }).catch((error: unknown) => error);

    expect(wrongPasswordFailure).toBeInstanceOf(InvalidCredentialsError);
    expect(unknownEmailFailure).toBeInstanceOf(InvalidCredentialsError);
    expect(wrongPasswordFailure).toEqual(unknownEmailFailure);
    expect(world.getCurrentSessionToken()).toBeNull();
  });

  it("reports an empty email and an empty password together, as validation, without calling the authenticator", async () => {
    const { signInWithPassword, dependencies } = await createSignInSetup();

    const failure = await signIn(dependencies, { email: "   ", password: "" }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(ValidationError);
    expect(failure).toMatchObject({
      issues: [
        { field: "email", code: "EMAIL_REQUIRED" },
        { field: "password", code: "PASSWORD_REQUIRED" },
      ],
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("checks nothing else before the credentials: a malformed email and a 3-character password get the credential answer", async () => {
    const { signInWithPassword, dependencies } = await createSignInSetup();

    await expect(
      signIn(dependencies, { email: "not an email", password: "abc" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(signInWithPassword).toHaveBeenCalledTimes(1);
  });

  describe("when the request already has a valid session", () => {
    it("answers already-signed-in, starts nothing and keeps the session", async () => {
      const { world, signInWithPassword, dependencies } = await createSignInSetup();
      await signIn(dependencies, { email: EMAIL, password: PASSWORD });
      const sessionTokenBefore = world.getCurrentSessionToken();
      signInWithPassword.mockClear();

      const result = await signIn(dependencies, { email: EMAIL, password: PASSWORD });

      expect(result).toEqual({ status: "already-signed-in" });
      expect(signInWithPassword).not.toHaveBeenCalled();
      expect(world.getCurrentSessionToken()).toBe(sessionTokenBefore);
    });

    it("validates nothing: empty fields still get already-signed-in", async () => {
      const { dependencies } = await createSignInSetup();
      await signIn(dependencies, { email: EMAIL, password: PASSWORD });

      const result = await signIn(dependencies, { email: "", password: "" });

      expect(result).toEqual({ status: "already-signed-in" });
    });
  });

  describe("when something fails outside the business rules", () => {
    it("lets the failure of the session reader through and calls nothing else", async () => {
      const { signInWithPassword, dependencies } = await createSignInSetup();
      const readerFailure = new InfrastructureError("The session could not be checked.");
      const failingSessionReader: SessionReader = {
        readActiveSession: async () => {
          throw readerFailure;
        },
      };

      const failure = await signIn(
        { ...dependencies, sessionReader: failingSessionReader },
        { email: EMAIL, password: PASSWORD },
      ).catch((error: unknown) => error);

      expect(failure).toBe(readerFailure);
      expect(signInWithPassword).not.toHaveBeenCalled();
    });

    it("lets the failure of the authenticator through as it is", async () => {
      const { signInWithPassword, dependencies } = await createSignInSetup();
      const authenticatorFailure = new InfrastructureError("The session could not be started.");
      signInWithPassword.mockRejectedValueOnce(authenticatorFailure);

      const failure = await signIn(dependencies, { email: EMAIL, password: PASSWORD }).catch(
        (error: unknown) => error,
      );

      expect(failure).toBe(authenticatorFailure);
    });
  });
});
