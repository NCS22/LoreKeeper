import { describe, expect, it, vi } from "vitest";
import { signOut } from "@/modules/accounts/application/sign-out";
import { signUp } from "@/modules/accounts/application/sign-up";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import { createFakeAccountAuthenticatorWorld } from "../../../support/fakes/fake-account-authenticator";

async function createSignedInSetup() {
  const world = createFakeAccountAuthenticatorWorld();
  await signUp(
    { accountAuthenticator: world.accountAuthenticator, sessionReader: world.sessionReader },
    {
      displayName: "Ana Torres",
      email: "ana@example.com",
      password: "correct horse",
      repeatPassword: "correct horse",
    },
  );
  return { world, dependencies: { accountAuthenticator: world.accountAuthenticator } };
}

describe("signOut", () => {
  it("ends the session in use and the old session is no longer valid", async () => {
    const { world, dependencies } = await createSignedInSetup();
    const sessionToken = world.getCurrentSessionToken();

    await signOut(dependencies);

    expect(await world.sessionReader.readActiveSession()).toBeNull();
    world.holdSessionToken(sessionToken);
    expect(await world.sessionReader.readActiveSession()).toBeNull();
  });

  it("succeeds when there is no session", async () => {
    const world = createFakeAccountAuthenticatorWorld();

    await expect(
      signOut({ accountAuthenticator: world.accountAuthenticator }),
    ).resolves.toBeUndefined();
  });

  it("succeeds when invoked twice", async () => {
    const { dependencies } = await createSignedInSetup();

    await signOut(dependencies);

    await expect(signOut(dependencies)).resolves.toBeUndefined();
  });

  it("lets the failure of the authenticator through as it is", async () => {
    const { world, dependencies } = await createSignedInSetup();
    const authenticatorFailure = new InfrastructureError("The session could not be ended.");
    vi.spyOn(world.accountAuthenticator, "signOutCurrentSession").mockRejectedValueOnce(
      authenticatorFailure,
    );

    const failure = await signOut(dependencies).catch((error: unknown) => error);

    expect(failure).toBe(authenticatorFailure);
  });
});
