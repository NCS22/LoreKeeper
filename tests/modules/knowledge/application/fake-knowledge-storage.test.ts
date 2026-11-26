import { describe, expect, it } from "vitest";
import { describeEntityStorageContract } from "../../../support/contracts/entity-repository-contract";
import {
  buildViewerContext,
  describeWorkStorageContract,
} from "../../../support/contracts/work-repository-contract";
import {
  buildNewWork,
  createFakeKnowledgeStorage,
} from "../../../support/knowledge-repository-factories";
import { buildUniverse } from "../../../support/universe-repository-factories";

describe("fake storage of works and entities", () => {
  describeWorkStorageContract("fake storage", createFakeKnowledgeStorage);
  describeEntityStorageContract("fake storage", createFakeKnowledgeStorage);

  // Not part of the shared contract: PostgreSQL is one shared database, so two storages over it
  // are never independent.
  it("keeps two fake storages independent", async () => {
    const universe = buildUniverse({ id: "00000000-0000-4000-8000-000000000001" });
    const firstStorage = await createFakeKnowledgeStorage([universe]);
    const secondStorage = await createFakeKnowledgeStorage([universe]);

    await firstStorage.workRepository.add(buildNewWork());

    expect(await secondStorage.workRepository.findAllInUniverse(buildViewerContext(universe))).toEqual([]);
  });
});
