import { describe, expect, it } from "vitest";
import { loadWorkspaceUniverses } from "@/modules/universes/application/load-workspace-universes";
import { toUniverseDto } from "@/modules/universes/application/universe-dto";
import {
  buildActingUser,
  buildUniverse,
  FIRST_OWNER_ID,
  SECOND_OWNER_ID,
  universeStorageFactories,
} from "../../../support/universe-repository-factories";

describe.each(universeStorageFactories)("loadWorkspaceUniverses: %s", (_name, createStorage) => {
  const actor = buildActingUser(FIRST_OWNER_ID);
  const otherActor = buildActingUser(SECOND_OWNER_ID);
  const oldestUniverse = buildUniverse({
    id: "00000000-0000-4000-8000-000000000001",
    name: "Oldest universe",
  });
  const newestUniverse = buildUniverse({
    id: "00000000-0000-4000-8000-000000000002",
    name: "Newest universe",
    mode: "AUTHOR",
    description: "Line one\nLine two",
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
  });
  const universeOfOtherActor = buildUniverse({
    id: "00000000-0000-4000-8000-000000000003",
    ownerId: SECOND_OWNER_ID,
    name: "Of the other",
  });

  it("loads nothing and selects nothing when the actor has no universes", async () => {
    const storage = await createStorage();

    expect(await loadWorkspaceUniverses(storage, actor)).toEqual({
      universes: [],
      initialUniverseId: null,
    });
  });

  it("lists the own universes as DTOs in creation order and selects the oldest", async () => {
    const storage = await createStorage([newestUniverse, oldestUniverse]);

    expect(await loadWorkspaceUniverses(storage, actor)).toEqual({
      universes: [toUniverseDto(oldestUniverse), toUniverseDto(newestUniverse)],
      initialUniverseId: oldestUniverse.id,
    });
  });

  it("selects the remembered universe when it is available", async () => {
    const storage = await createStorage([oldestUniverse, newestUniverse]);
    await storage.rememberedUniverseRepository.saveRememberedUniverse(
      FIRST_OWNER_ID,
      newestUniverse.id,
    );

    const { initialUniverseId } = await loadWorkspaceUniverses(storage, actor);

    expect(initialUniverseId).toBe(newestUniverse.id);
  });

  it("falls back to the oldest universe, without an error, when the remembered one is not an own universe", async () => {
    const storage = await createStorage([oldestUniverse, universeOfOtherActor]);
    await storage.rememberedUniverseRepository.saveRememberedUniverse(
      FIRST_OWNER_ID,
      "00000000-0000-4000-8000-0000000000ff",
    );

    const { initialUniverseId } = await loadWorkspaceUniverses(storage, actor);

    expect(initialUniverseId).toBe(oldestUniverse.id);
  });

  it("never lists the universes of another account", async () => {
    const storage = await createStorage([oldestUniverse, universeOfOtherActor]);

    const ownWorkspace = await loadWorkspaceUniverses(storage, actor);
    const otherWorkspace = await loadWorkspaceUniverses(storage, otherActor);

    expect(ownWorkspace.universes.map((universe) => universe.id)).toEqual([oldestUniverse.id]);
    expect(otherWorkspace.universes.map((universe) => universe.id)).toEqual([
      universeOfOtherActor.id,
    ]);
  });

  it("never lets the remembered universe of another account cross", async () => {
    const storage = await createStorage([oldestUniverse, newestUniverse, universeOfOtherActor]);
    await storage.rememberedUniverseRepository.saveRememberedUniverse(
      SECOND_OWNER_ID,
      universeOfOtherActor.id,
    );
    await storage.rememberedUniverseRepository.saveRememberedUniverse(
      FIRST_OWNER_ID,
      newestUniverse.id,
    );

    expect((await loadWorkspaceUniverses(storage, actor)).initialUniverseId).toBe(
      newestUniverse.id,
    );
    expect((await loadWorkspaceUniverses(storage, otherActor)).initialUniverseId).toBe(
      universeOfOtherActor.id,
    );
  });
});
