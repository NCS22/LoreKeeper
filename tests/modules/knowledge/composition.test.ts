import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActingUser } from "@/shared/domain/acting-user";
import { InfrastructureError } from "@/shared/domain/error-kinds";

const PRISMA_CLIENT_GLOBAL_KEY = Symbol.for("lorekeeper.prismaClient");
const UNIVERSE_ID = "2f6c1c0e-5f0a-4c3e-8d1b-9a7e6b5c4d3a";

const actingUser: ActingUser = {
  userId: "7b1f6f1e-0f44-4d6f-9d47-0c8a3d2f2a11",
  displayName: "Ana Torres",
  email: "ana@example.com",
};

// Imported inside each test, after the environment is emptied, so the import itself runs without environment.
function importComposition() {
  return import("@/modules/knowledge/composition");
}

function readFailure(work: Promise<unknown>): Promise<unknown> {
  return work.then(
    () => {
      throw new Error("Expected the operation to fail, but it succeeded.");
    },
    (reason: unknown) => reason,
  );
}

describe("the composition of the knowledge module without environment", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("can be imported and composed without throwing and without building a Prisma client", async () => {
    const { createKnowledgeModule } = await importComposition();

    expect(() => createKnowledgeModule()).not.toThrow();

    const globalScope = globalThis as Record<symbol, unknown>;
    expect(globalScope[PRISMA_CLIENT_GLOBAL_KEY]).toBeUndefined();
  });

  it("offers the three operations", async () => {
    const { createKnowledgeModule } = await importComposition();

    expect(Object.keys(createKnowledgeModule()).sort()).toEqual([
      "createEntity",
      "createWork",
      "loadUniverseKnowledge",
    ]);
  });

  it("checks the universe through the universes module first, so every operation fails with the InfrastructureError without a database", async () => {
    const { createKnowledgeModule } = await importComposition();
    const knowledgeModule = createKnowledgeModule();

    const failures = await Promise.all([
      readFailure(
        knowledgeModule.createWork(actingUser, {
          universeId: UNIVERSE_ID,
          title: "My Novel",
          medium: "NOVEL",
          unitCount: "3",
        }),
      ),
      readFailure(
        knowledgeModule.createEntity(actingUser, {
          universeId: UNIVERSE_ID,
          name: "Frodo",
          type: "CHARACTER",
          boundary: { workId: UNIVERSE_ID, unitNumber: "1" },
        }),
      ),
      readFailure(knowledgeModule.loadUniverseKnowledge(actingUser, UNIVERSE_ID)),
    ]);

    expect(failures).toHaveLength(3);
    for (const failure of failures) {
      expect(failure).toBeInstanceOf(InfrastructureError);
    }
  });

  it("is exposed through the public interface of the module", async () => {
    const publicInterface = await import("@/modules/knowledge");

    expect(typeof publicInterface.createKnowledgeModule).toBe("function");
    expect(publicInterface.WORK_MEDIUMS).toEqual([
      "NOVEL",
      "MANGA",
      "COMIC",
      "ANIME",
      "TV_SERIES",
      "FILM",
      "OTHER",
    ]);
    expect(publicInterface.ENTITY_TYPES).toHaveLength(8);
    expect(publicInterface.KNOWLEDGE_STATUSES).toEqual(["CONFIRMED", "USER_NOTE", "SPECULATION"]);
    expect(publicInterface.isBlankFragmentContent(" \t ")).toBe(true);
  });
});
