import { describe, expect, it } from "vitest";
import { describeUniverseStorageContract } from "../../../support/contracts/universe-repository-contract";
import {
  buildUniverse,
  createFakeUniverseStorage,
  FIRST_OWNER_ID,
} from "../../../support/universe-repository-factories";

describe("fake storage of universes", () => {
  describeUniverseStorageContract("fake storage", createFakeUniverseStorage);

  // Not part of the shared contract: PostgreSQL is one shared database, so two storages over it
  // are never independent.
  it("keeps two fake storages independent", async () => {
    const firstStorage = await createFakeUniverseStorage();
    const secondStorage = await createFakeUniverseStorage();

    await firstStorage.universeRepository.add(buildUniverse());

    expect(await secondStorage.universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([]);
  });
});
