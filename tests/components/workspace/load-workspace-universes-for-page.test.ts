import { describe, expect, it, vi } from "vitest";
import { loadWorkspaceUniversesForPage } from "@/components/workspace/load-workspace-universes-for-page";
import { createAccountsModule } from "@/modules/accounts";
import { createUniversesModule } from "@/modules/universes";
import { INFRASTRUCTURE_ERROR_CODE, InfrastructureError } from "@/shared/domain/error-kinds";
import { getBetterAuthInstance } from "@/shared/infrastructure/better-auth-instance";
import { getPrismaClient } from "@/shared/infrastructure/prisma-client";
import { getActingUser } from "@/shared/presentation/get-acting-user";
import {
  TEST_SESSION_COOKIE_NAME,
  prepareRealCompositionOverTestDatabase,
} from "../../support/database/real-composition-environment";
import { emulatedBrowser } from "../../support/emulated-next-headers";

vi.mock("next/headers", async () =>
  (await import("../../support/emulated-next-headers")).nextHeadersModuleReplacement,
);

const PASSWORD = "unique-typed-password-4f9c1a";

prepareRealCompositionOverTestDatabase();

async function signUp(displayName: string, email: string): Promise<void> {
  await createAccountsModule().signUp({ displayName, email, password: PASSWORD, repeatPassword: PASSWORD });
}

describe("loadWorkspaceUniversesForPage", () => {
  it("loads the own universes, the one to select first and the account key of a signed-in person", async () => {
    await signUp("Ana Torres", "ana@example.com");
    const actor = await getActingUser();
    const universesModule = createUniversesModule();
    const oldestUniverse = await universesModule.createUniverse(actor, { name: "Oldest", description: null, mode: "READER" });
    await universesModule.createUniverse(actor, { name: "Newest", description: "A later one.", mode: "AUTHOR" });

    const pageLoad = await loadWorkspaceUniversesForPage();

    expect(pageLoad).toMatchObject({
      status: "loaded",
      initialUniverseId: oldestUniverse.id,
      accountKey: actor.userId,
    });
    expect(pageLoad.status === "loaded" ? pageLoad.universes.map((universe) => universe.name) : []).toEqual([
      "Oldest",
      "Newest",
    ]);
  });

  it("selects the remembered universe first", async () => {
    await signUp("Ana Torres", "ana@example.com");
    const actor = await getActingUser();
    const universesModule = createUniversesModule();
    await universesModule.createUniverse(actor, { name: "Oldest", description: null, mode: "READER" });
    const newestUniverse = await universesModule.createUniverse(actor, { name: "Newest", description: null, mode: "READER" });
    await universesModule.rememberUniverse(actor, { universeId: newestUniverse.id });

    const pageLoad = await loadWorkspaceUniversesForPage();

    expect(pageLoad).toMatchObject({ status: "loaded", initialUniverseId: newestUniverse.id });
  });

  it("loads no universe and selects none for an account that has none", async () => {
    await signUp("Ana Torres", "ana@example.com");

    const pageLoad = await loadWorkspaceUniversesForPage();

    expect(pageLoad).toMatchObject({ status: "loaded", universes: [], initialUniverseId: null });
  });

  it("never loads the universes of another account", async () => {
    await signUp("Ana Torres", "ana@example.com");
    const anaActor = await getActingUser();
    await createUniversesModule().createUniverse(anaActor, { name: "Ana's", description: null, mode: "READER" });
    emulatedBrowser.clear();
    await signUp("Beto Ruiz", "beto@example.com");

    const pageLoad = await loadWorkspaceUniversesForPage();

    expect(pageLoad).toMatchObject({ status: "loaded", universes: [], initialUniverseId: null });
  });

  it("reports signed out when there is no session", async () => {
    expect(await loadWorkspaceUniversesForPage()).toEqual({ status: "signed-out" });
  });

  it("reports signed out when the session cookie is not a stored session", async () => {
    emulatedBrowser.holdCookie(TEST_SESSION_COOKIE_NAME, "not-a-real-session-token");

    expect(await loadWorkspaceUniversesForPage()).toEqual({ status: "signed-out" });
  });

  it("rethrows a session that cannot be checked instead of reporting signed out", async () => {
    await signUp("Ana Torres", "ana@example.com");
    vi.spyOn(getBetterAuthInstance().api, "getSession").mockRejectedValue(new Error("connection refused"));

    await expect(loadWorkspaceUniversesForPage()).rejects.toMatchObject({ code: INFRASTRUCTURE_ERROR_CODE });
  });

  it("rethrows a failure to read the universes", async () => {
    await signUp("Ana Torres", "ana@example.com");
    vi.spyOn(getPrismaClient().universe, "findMany").mockRejectedValue(new Error("connection refused"));

    await expect(loadWorkspaceUniversesForPage()).rejects.toBeInstanceOf(InfrastructureError);
  });
});
