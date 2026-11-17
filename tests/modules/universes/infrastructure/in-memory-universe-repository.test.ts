import { describe } from "vitest";
import { createInMemoryUniverseRepository } from "@/modules/universes/infrastructure/in-memory-universe-repository";
import {
  describeUniverseStorageContract,
  type UniverseStorageFactory,
} from "../../../support/contracts/universe-repository-contract";
import { createFakeRememberedUniverseRepository } from "../../../support/fakes/fake-remembered-universe-repository";

// The temporary in-memory repository only stores universes; the remembered universe of the
// contract is kept by the fake. Deleted together with the repository (bridge).
const createInMemoryStorage: UniverseStorageFactory = async (startingUniverses) => ({
  universeRepository: createInMemoryUniverseRepository(startingUniverses),
  rememberedUniverseRepository: createFakeRememberedUniverseRepository(),
});

describe("in-memory universe repository", () => {
  describeUniverseStorageContract("in-memory repository", createInMemoryStorage);
});
