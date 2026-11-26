import { describe, expect, it } from "vitest";
import { listEntities } from "@/modules/knowledge/application/list-entities";
import { storeWorkWithBoundaries } from "../../../support/contracts/entity-repository-contract";
import {
  buildViewerContext,
  FIRST_UNIVERSE,
  SECOND_OWNER_UNIVERSE,
} from "../../../support/contracts/work-repository-contract";
import {
  buildNewEntity,
  buildNewWork,
  knowledgeStorageFactories,
} from "../../../support/knowledge-repository-factories";

describe.each(knowledgeStorageFactories)("listEntities: %s", (_name, createStorage) => {
  async function setUp() {
    const storage = await createStorage([FIRST_UNIVERSE, SECOND_OWNER_UNIVERSE]);
    const [ownUnit] = await storeWorkWithBoundaries(storage, buildNewWork());
    const [foreignUnit] = await storeWorkWithBoundaries(
      storage,
      buildNewWork({ id: "00000000-0000-4000-8000-0000000000a9", universeId: SECOND_OWNER_UNIVERSE.id }),
    );
    return { storage, ownUnit, foreignUnit };
  }

  it("lists the entity summaries in creation order, ties by identifier", async () => {
    const { storage, ownUnit } = await setUp();
    const sameInstant = new Date("2026-03-05T10:00:00.000Z");
    await storage.entityRepository.add(
      buildNewEntity({
        id: "00000000-0000-4000-8000-0000000000d1",
        name: "Newest",
        type: "OBJECT",
        introducedAt: ownUnit,
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
      }),
    );
    await storage.entityRepository.add(
      buildNewEntity({
        id: "00000000-0000-4000-8000-0000000000e2",
        name: "Tied, higher identifier",
        introducedAt: ownUnit,
        createdAt: sameInstant,
      }),
    );
    await storage.entityRepository.add(
      buildNewEntity({
        id: "00000000-0000-4000-8000-0000000000e1",
        name: "Tied, lower identifier",
        type: "CONCEPT",
        introducedAt: ownUnit,
        createdAt: sameInstant,
      }),
    );

    expect(await listEntities(storage, buildViewerContext())).toEqual([
      {
        id: "00000000-0000-4000-8000-0000000000e1",
        name: "Tied, lower identifier",
        type: "CONCEPT",
        createdAt: "2026-03-05T10:00:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-0000000000e2",
        name: "Tied, higher identifier",
        type: "CHARACTER",
        createdAt: "2026-03-05T10:00:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-0000000000d1",
        name: "Newest",
        type: "OBJECT",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ]);
  });

  it("lists nothing for a universe without entities", async () => {
    const { storage } = await setUp();

    expect(await listEntities(storage, buildViewerContext())).toEqual([]);
  });

  it("never lists the entities of another account's universe", async () => {
    const { storage, foreignUnit } = await setUp();
    await storage.entityRepository.add(
      buildNewEntity({
        universeId: SECOND_OWNER_UNIVERSE.id,
        name: "Secret entity of the other account",
        introducedAt: foreignUnit,
      }),
    );

    expect(await listEntities(storage, buildViewerContext(FIRST_UNIVERSE))).toEqual([]);
  });
});
