import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActingUser } from "@/shared/domain/acting-user";
import { InfrastructureError } from "@/shared/domain/error-kinds";

const PRISMA_CLIENT_GLOBAL_KEY = Symbol.for("lorekeeper.prismaClient");

const actingUser: ActingUser = {
  userId: "7b1f6f1e-0f44-4d6f-9d47-0c8a3d2f2a11",
  displayName: "Ana Torres",
  email: "ana@example.com",
};

// Imported inside each test, after the environment is emptied, so the import itself runs without environment.
function importComposition() {
  return import("@/modules/universes/composition");
}

function readFailure(work: Promise<unknown>): Promise<unknown> {
  return work.then(
    () => {
      throw new Error("Expected the operation to fail, but it succeeded.");
    },
    (reason: unknown) => reason,
  );
}

describe("the composition of the universes module without environment", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("can be imported and composed without throwing and without building a Prisma client", async () => {
    const { createUniversesModule } = await importComposition();

    expect(() => createUniversesModule()).not.toThrow();

    const globalScope = globalThis as Record<symbol, unknown>;
    expect(globalScope[PRISMA_CLIENT_GLOBAL_KEY]).toBeUndefined();
  });

  it("offers the six use cases", async () => {
    const { createUniversesModule } = await importComposition();
    const universesModule = createUniversesModule();

    expect(Object.keys(universesModule).sort()).toEqual([
      "createUniverse",
      "findOwnUniverse",
      "isUniverseNameInUse",
      "listRelationshipTypes",
      "loadWorkspaceUniverses",
      "rememberUniverse",
    ]);
  });

  it("fails every use case that needs the database with the InfrastructureError", async () => {
    const { createUniversesModule } = await importComposition();
    const universesModule = createUniversesModule();

    const failures = await Promise.all([
      readFailure(
        universesModule.createUniverse(actingUser, { name: "Valid", description: null, mode: "READER" }),
      ),
      readFailure(universesModule.loadWorkspaceUniverses(actingUser)),
      readFailure(universesModule.isUniverseNameInUse(actingUser, "Valid")),
      readFailure(
        universesModule.rememberUniverse(actingUser, {
          universeId: "2f6c1c0e-5f0a-4c3e-8d1b-9a7e6b5c4d3a",
        }),
      ),
      readFailure(
        universesModule.findOwnUniverse(actingUser, "2f6c1c0e-5f0a-4c3e-8d1b-9a7e6b5c4d3a"),
      ),
      readFailure(
        universesModule.listRelationshipTypes(actingUser, "2f6c1c0e-5f0a-4c3e-8d1b-9a7e6b5c4d3a"),
      ),
    ]);

    expect(failures).toHaveLength(6);

    for (const failure of failures) {
      expect(failure).toBeInstanceOf(InfrastructureError);
    }
  });

  it("is exposed through the public interface of the module", async () => {
    const publicInterface = await import("@/modules/universes");

    expect(typeof publicInterface.createUniversesModule).toBe("function");
    expect(publicInterface.DEFAULT_UNIVERSE_MODE).toBe("READER");
  });
});
