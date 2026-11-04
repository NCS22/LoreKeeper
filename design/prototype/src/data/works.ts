import type { NarrativeUnitDto, WorkDto } from "@/dto/work";

const TIMESTAMP = "2026-10-02T09:00:00.000Z";

export const NOVEL_WORK_ID = "work-ashes-of-the-concordat";
export const ANIME_WORK_ID = "work-ashes-of-the-concordat-anime";
export const TIDEWRACK_WORK_ID = "work-the-salt-ledger";

export const WORKS: readonly WorkDto[] = [
  {
    id: NOVEL_WORK_ID,
    universeId: "universe-ember-concordat",
    title: "Ashes of the Concordat",
    medium: "NOVEL",
    unitKind: "CHAPTER",
    description: "The original three-volume novel.",
    coverImageUrl: null,
    displayOrder: 1,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  },
  {
    id: ANIME_WORK_ID,
    universeId: "universe-ember-concordat",
    title: "Ashes of the Concordat: The Animation",
    medium: "ANIME",
    unitKind: "EPISODE",
    description: "Twelve-episode adaptation of the first two volumes.",
    coverImageUrl: null,
    displayOrder: 2,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  },
  {
    id: TIDEWRACK_WORK_ID,
    universeId: "universe-tidewrack",
    title: "The Salt Ledger",
    medium: "MANGA",
    unitKind: "CHAPTER",
    description: "A serialized manga about the keepers of the wreck ledgers.",
    coverImageUrl: null,
    displayOrder: 1,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  },
];

type UnitGroup = { groupLabel: string | null; labels: readonly string[] };

// Units keep the order they are declared in, which is the order of the work.
function createUnits(workId: string, groups: readonly UnitGroup[]): NarrativeUnitDto[] {
  return groups
    .flatMap((group) => group.labels.map((label) => ({ label, groupLabel: group.groupLabel })))
    .map((unit, index) => ({ id: `${workId}-unit-${index + 1}`, workId, label: unit.label, groupLabel: unit.groupLabel }));
}

export const NARRATIVE_UNITS: readonly NarrativeUnitDto[] = [
  ...createUnits(NOVEL_WORK_ID, [
    { groupLabel: null, labels: ["Prologue"] },
    { groupLabel: "Volume 1", labels: ["Vol. 1, Ch. 1", "Vol. 1, Ch. 2", "Vol. 1, Ch. 3", "Vol. 1, Ch. 4", "Vol. 1, Ch. 5"] },
    { groupLabel: null, labels: ["Interlude"] },
    { groupLabel: "Volume 2", labels: ["Vol. 2, Ch. 1", "Vol. 2, Ch. 2", "Vol. 2, Ch. 3", "Vol. 2, Ch. 4", "Vol. 2, Ch. 5", "Vol. 2, Ch. 6"] },
    { groupLabel: "Volume 3", labels: ["Vol. 3, Ch. 1", "Vol. 3, Ch. 2", "Vol. 3, Ch. 3", "Vol. 3, Ch. 4"] },
    { groupLabel: null, labels: ["Epilogue"] },
  ]),
  ...createUnits(ANIME_WORK_ID, [
    {
      groupLabel: "Season 1",
      labels: ["Ep. 1", "Ep. 2", "Ep. 3", "Ep. 4", "Ep. 5", "Ep. 6", "Ep. 7", "Ep. 8", "Ep. 9", "Ep. 10", "Ep. 11", "Ep. 12"],
    },
  ]),
  ...createUnits(TIDEWRACK_WORK_ID, [
    { groupLabel: null, labels: ["Ch. 1", "Ch. 2", "Ch. 3", "Ch. 4", "Ch. 5", "Ch. 6", "Ch. 7", "Ch. 8"] },
  ]),
];
