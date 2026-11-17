import { describe } from "vitest";
import { describeUniverseStorageContract } from "../../../support/contracts/universe-repository-contract";
import { universeStorageFactories } from "../../../support/universe-repository-factories";

describe("storages of universes", () => {
  universeStorageFactories.forEach(([storageName, createStorage]) => {
    describeUniverseStorageContract(storageName, createStorage);
  });
});
