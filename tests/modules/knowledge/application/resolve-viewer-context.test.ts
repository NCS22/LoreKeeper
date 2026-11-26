import { afterAll, describe, expect, it } from "vitest";
import { resolveViewerContext } from "@/modules/knowledge/application/resolve-viewer-context";
import { KnowledgeItemNotFoundError } from "@/modules/knowledge/domain/knowledge-errors";
import { ValidationError } from "@/shared/domain/validation-error";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import { FIRST_UNIVERSE, SECOND_OWNER_UNIVERSE } from "../../../support/contracts/work-repository-contract";
import { createPostgresKnowledgeStorage } from "../../../support/database/postgres-knowledge-storage";
import { createTestPrismaClient } from "../../../support/database/test-database";
import { knowledgeStorageFactories } from "../../../support/knowledge-repository-factories";
import { buildActingUser, FIRST_OWNER_ID, SECOND_OWNER_ID } from "../../../support/universe-owners";

const NONEXISTENT_UNIVERSE_ID = "00000000-0000-4000-8000-0000000000ff";

async function captureRejection(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the operation to be rejected.");
}

describe.each(knowledgeStorageFactories)("resolveViewerContext: %s", (_name, createStorage) => {
  const actor = buildActingUser(FIRST_OWNER_ID);
  const otherActor = buildActingUser(SECOND_OWNER_ID);

  async function setUp() {
    return createStorage([FIRST_UNIVERSE, SECOND_OWNER_UNIVERSE]);
  }

  it("builds the context of an own universe with the viewer, the universe and its mode", async () => {
    const storage = await setUp();

    expect(await resolveViewerContext(storage, actor, FIRST_UNIVERSE.id)).toEqual({
      viewerUserId: FIRST_OWNER_ID,
      universeId: FIRST_UNIVERSE.id,
      universeMode: "READER",
    });
    expect(await resolveViewerContext(storage, otherActor, SECOND_OWNER_UNIVERSE.id)).toEqual({
      viewerUserId: SECOND_OWNER_ID,
      universeId: SECOND_OWNER_UNIVERSE.id,
      universeMode: "AUTHOR",
    });
  });

  it("uses the stored identifier when it is sent in upper case", async () => {
    const storage = await setUp();

    const viewerContext = await resolveViewerContext(storage, actor, FIRST_UNIVERSE.id.toUpperCase());

    expect(viewerContext.universeId).toBe(FIRST_UNIVERSE.id);
  });

  it("gives the same not found error for a universe of another account and for a nonexistent one", async () => {
    const storage = await setUp();

    const foreignFailure = await captureRejection(
      resolveViewerContext(storage, actor, SECOND_OWNER_UNIVERSE.id),
    );
    const nonexistentFailure = await captureRejection(
      resolveViewerContext(storage, actor, NONEXISTENT_UNIVERSE_ID),
    );

    expect(foreignFailure).toBeInstanceOf(KnowledgeItemNotFoundError);
    expect(nonexistentFailure).toBeInstanceOf(KnowledgeItemNotFoundError);
    expect(foreignFailure).toEqual(nonexistentFailure);
  });

  it("rejects a malformed identifier as a validation error on universeId", async () => {
    const storage = await setUp();

    const failure = await captureRejection(resolveViewerContext(storage, actor, "not-a-uuid"));

    expect(failure).toBeInstanceOf(ValidationError);
    expect(failure).toMatchObject({ issues: [{ field: "universeId", code: "UNIVERSE_ID_INVALID" }] });
  });
});

describe("resolveViewerContext: a deleted universe in PostgreSQL", () => {
  let client: PrismaClient | null = null;

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("gives the not found error, as for a nonexistent universe", async () => {
    const storage = await createPostgresKnowledgeStorage([FIRST_UNIVERSE]);
    client = createTestPrismaClient();
    await client.universe.update({
      where: { id: FIRST_UNIVERSE.id },
      data: { deletedAt: new Date("2026-02-02T10:00:00.000Z") },
    });

    await expect(
      resolveViewerContext(storage, buildActingUser(FIRST_OWNER_ID), FIRST_UNIVERSE.id),
    ).rejects.toBeInstanceOf(KnowledgeItemNotFoundError);
  });
});
