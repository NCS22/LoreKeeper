import { describe, expect, it } from "vitest";
import { listWorks } from "@/modules/knowledge/application/list-works";
import {
  buildViewerContext,
  FIRST_UNIVERSE,
  SECOND_OWNER_UNIVERSE,
} from "../../../support/contracts/work-repository-contract";
import {
  buildNewWork,
  buildNumberedTestUnits,
  knowledgeStorageFactories,
} from "../../../support/knowledge-repository-factories";

describe.each(knowledgeStorageFactories)("listWorks: %s", (_name, createStorage) => {
  async function setUp() {
    return createStorage([FIRST_UNIVERSE, SECOND_OWNER_UNIVERSE]);
  }

  it("lists the works in creation order with title, medium, unit wording and number of units", async () => {
    const storage = await setUp();
    await storage.workRepository.add(
      buildNewWork({
        id: "00000000-0000-4000-8000-0000000000a2",
        title: "Second",
        medium: "TV_SERIES",
        units: buildNumberedTestUnits(24),
        createdAt: new Date("2026-03-02T10:00:00.000Z"),
        updatedAt: new Date("2026-03-02T10:00:00.000Z"),
      }),
    );
    await storage.workRepository.add(
      buildNewWork({
        id: "00000000-0000-4000-8000-0000000000a1",
        title: "First",
        medium: "FILM",
        units: buildNumberedTestUnits(1),
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
        updatedAt: new Date("2026-03-01T10:00:00.000Z"),
      }),
    );

    expect(await listWorks(storage, buildViewerContext())).toEqual([
      {
        id: "00000000-0000-4000-8000-0000000000a1",
        title: "First",
        medium: "FILM",
        unitWording: "unit",
        unitCount: 1,
        createdAt: "2026-03-01T10:00:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-0000000000a2",
        title: "Second",
        medium: "TV_SERIES",
        unitWording: "episode",
        unitCount: 24,
        createdAt: "2026-03-02T10:00:00.000Z",
      },
    ]);
  });

  it("lists two works with the same title as two works", async () => {
    const storage = await setUp();
    await storage.workRepository.add(buildNewWork({ id: "00000000-0000-4000-8000-0000000000a1" }));
    await storage.workRepository.add(buildNewWork({ id: "00000000-0000-4000-8000-0000000000a2" }));

    const listedWorks = await listWorks(storage, buildViewerContext());

    expect(listedWorks.map((work) => work.title)).toEqual(["My Novel", "My Novel"]);
  });

  it("lists nothing for a universe without works", async () => {
    const storage = await setUp();

    expect(await listWorks(storage, buildViewerContext())).toEqual([]);
  });

  it("never lists the works of another account's universe", async () => {
    const storage = await setUp();
    await storage.workRepository.add(
      buildNewWork({ universeId: SECOND_OWNER_UNIVERSE.id, title: "Secret work of the other account" }),
    );

    expect(await listWorks(storage, buildViewerContext(FIRST_UNIVERSE))).toEqual([]);
  });
});
