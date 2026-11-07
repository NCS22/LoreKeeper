import { describe, expect, it, vi } from "vitest";
import { signUp, type SignUpCommand } from "@/modules/accounts/application/sign-up";
import { EmailAlreadyRegisteredError } from "@/modules/accounts/domain/account-errors";
import type { SessionReader } from "@/shared/application/session-reader";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import { ValidationError } from "@/shared/domain/validation-error";
import { createFakeAccountAuthenticatorWorld } from "../../../support/fakes/fake-account-authenticator";

const validCommand: SignUpCommand = {
  displayName: "  Ana Torres  ",
  email: " Ana@Example.com ",
  password: "correct horse",
  repeatPassword: "correct horse",
};

function createSignUpSetup() {
  const world = createFakeAccountAuthenticatorWorld();
  const registerAndSignIn = vi.spyOn(world.accountAuthenticator, "registerAndSignIn");
  const dependencies = {
    accountAuthenticator: world.accountAuthenticator,
    sessionReader: world.sessionReader,
  };
  return { world, registerAndSignIn, dependencies };
}

describe("signUp", () => {
  it("creates the account with the comparable email and the trimmed name, and signs the person in", async () => {
    const { world, dependencies } = createSignUpSetup();

    const result = await signUp(dependencies, validCommand);

    expect(result).toEqual({ status: "signed-up" });
    expect(await world.readAccountByEmail("ana@example.com")).toMatchObject({
      displayName: "Ana Torres",
      email: "ana@example.com",
    });
    expect(await world.sessionReader.readActiveSession()).not.toBeNull();
  });

  it("reports every failing field together and creates nothing", async () => {
    const { world, registerAndSignIn, dependencies } = createSignUpSetup();

    const failure = await signUp(dependencies, {
      displayName: "   ",
      email: "not an email",
      password: "short",
      repeatPassword: "different",
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ValidationError);
    expect(failure).toMatchObject({
      issues: [
        { field: "displayName" },
        { field: "email" },
        { field: "password" },
        { field: "repeatPassword" },
      ],
    });
    expect(registerAndSignIn).not.toHaveBeenCalled();
    expect(await world.countAccounts()).toBe(0);
    expect(world.getCurrentSessionToken()).toBeNull();
  });

  it("rejects a repeat password that differs and creates nothing", async () => {
    const { world, registerAndSignIn, dependencies } = createSignUpSetup();

    await expect(
      signUp(dependencies, { ...validCommand, repeatPassword: "correct horsee" }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(registerAndSignIn).not.toHaveBeenCalled();
    expect(await world.countAccounts()).toBe(0);
  });

  it("rejects an email that is already registered, whatever its case, and starts no session", async () => {
    const { world, dependencies } = createSignUpSetup();
    await signUp(dependencies, validCommand);
    world.holdSessionToken(null);

    await expect(
      signUp(dependencies, { ...validCommand, email: "ANA@EXAMPLE.COM", displayName: "Other" }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);

    expect(await world.countAccounts()).toBe(1);
    expect(world.getCurrentSessionToken()).toBeNull();
  });

  describe("when the request already has a valid session", () => {
    it("answers already-signed-in, creates nothing and keeps the session", async () => {
      const { world, registerAndSignIn, dependencies } = createSignUpSetup();
      await signUp(dependencies, validCommand);
      const sessionTokenBefore = world.getCurrentSessionToken();
      registerAndSignIn.mockClear();

      const result = await signUp(dependencies, {
        ...validCommand,
        email: "other@example.com",
      });

      expect(result).toEqual({ status: "already-signed-in" });
      expect(registerAndSignIn).not.toHaveBeenCalled();
      expect(await world.countAccounts()).toBe(1);
      expect(world.getCurrentSessionToken()).toBe(sessionTokenBefore);
      expect(await world.sessionReader.readActiveSession()).not.toBeNull();
    });

    it("validates nothing: invalid input still gets already-signed-in", async () => {
      const { dependencies } = createSignUpSetup();
      await signUp(dependencies, validCommand);

      const result = await signUp(dependencies, {
        displayName: "",
        email: "",
        password: "",
        repeatPassword: "x",
      });

      expect(result).toEqual({ status: "already-signed-in" });
    });
  });

  describe("when something fails outside the business rules", () => {
    it("lets the failure of the session reader through and calls nothing else", async () => {
      const { registerAndSignIn, dependencies } = createSignUpSetup();
      const readerFailure = new InfrastructureError("The session could not be checked.");
      const failingSessionReader: SessionReader = {
        readActiveSession: async () => {
          throw readerFailure;
        },
      };

      const failure = await signUp(
        { ...dependencies, sessionReader: failingSessionReader },
        validCommand,
      ).catch((error: unknown) => error);

      expect(failure).toBe(readerFailure);
      expect(registerAndSignIn).not.toHaveBeenCalled();
    });

    it("lets the failure of the authenticator through as it is", async () => {
      const { registerAndSignIn, dependencies } = createSignUpSetup();
      const authenticatorFailure = new InfrastructureError("The account could not be created.");
      registerAndSignIn.mockRejectedValueOnce(authenticatorFailure);

      const failure = await signUp(dependencies, validCommand).catch((error: unknown) => error);

      expect(failure).toBe(authenticatorFailure);
    });
  });
});
