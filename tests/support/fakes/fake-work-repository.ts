import type { NewNarrativeUnit, Work } from "@/modules/knowledge/domain/work";
import { parseWorkMedium } from "@/modules/knowledge/domain/work-medium";
import type { WorkRepository } from "@/modules/knowledge/domain/work-repository";
import { InfrastructureError } from "@/shared/domain/error-kinds";

type SerializedWork = {
  readonly id: string;
  readonly universeId: string;
  readonly title: string;
  readonly medium: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type StoredWorkRow = {
  readonly serializedWork: string;
  readonly serializedUnits: string;
};

/** The test repository of works, with what a test needs to look at or to make the storage fail. */
export type FakeWorkRepository = WorkRepository & {
  /** The stored units of a work, in order, as `{ label, ordinal }`. */
  readStoredUnitsOfWork(workId: string): readonly NewNarrativeUnit[];
  countStoredWorks(): number;
  /** Makes every following write of a unit fail, until `restoreUnitWrites`. */
  makeUnitWritesFail(): void;
  restoreUnitWrites(): void;
};

function deserializeWork(serializedWork: string, unitCount: number): Work {
  // JSON.parse is typed as returning `any`; the annotation narrows it to the shape written by `add`.
  const row: SerializedWork = JSON.parse(serializedWork);
  const medium = parseWorkMedium(row.medium);
  if (medium === null) {
    throw new Error("The fake repository holds a work with an invalid medium.");
  }
  return {
    id: row.id,
    universeId: row.universeId,
    title: row.title,
    medium,
    unitCount,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function compareByCreationThenId(firstWork: Work, secondWork: Work): number {
  const creationDifference = firstWork.createdAt.getTime() - secondWork.createdAt.getTime();
  if (creationDifference !== 0) {
    return creationDifference;
  }
  return firstWork.id.localeCompare(secondWork.id, "en");
}

/**
 * Works and units in memory, held as serialized text so nothing the caller keeps can alter what is
 * stored. It must give the same results as the PostgreSQL repository (NFR-1): the order, the scope
 * by universe and the all-or-nothing write of a work with its units.
 */
export function createFakeWorkRepository(): FakeWorkRepository {
  const rowsByWorkId = new Map<string, StoredWorkRow>();
  let unitWritesFail = false;

  function readUnits(row: StoredWorkRow): NewNarrativeUnit[] {
    // JSON.parse is typed as returning `any`; the annotation narrows it to the shape written by `add`.
    const units: NewNarrativeUnit[] = JSON.parse(row.serializedUnits);
    return units;
  }

  return {
    async add(newWork) {
      // The units are checked first: when they fail, the work is not stored either.
      if (unitWritesFail && newWork.units.length > 0) {
        throw new InfrastructureError("The fake storage failed while trying to store the units.");
      }
      const { units, ...work } = newWork;
      rowsByWorkId.set(newWork.id, {
        serializedWork: JSON.stringify({
          ...work,
          createdAt: work.createdAt.toISOString(),
          updatedAt: work.updatedAt.toISOString(),
        }),
        serializedUnits: JSON.stringify(
          units.map((unit) => ({ label: unit.label, ordinal: unit.ordinal })),
        ),
      });
    },
    async findAllInUniverse(viewerContext) {
      return [...rowsByWorkId.values()]
        .map((row) => deserializeWork(row.serializedWork, readUnits(row).length))
        .filter((work) => work.universeId === viewerContext.universeId)
        .sort(compareByCreationThenId);
    },
    readStoredUnitsOfWork(workId) {
      const row = rowsByWorkId.get(workId);
      if (row === undefined) {
        return [];
      }
      return readUnits(row).sort((firstUnit, secondUnit) => firstUnit.ordinal - secondUnit.ordinal);
    },
    countStoredWorks() {
      return rowsByWorkId.size;
    },
    makeUnitWritesFail() {
      unitWritesFail = true;
    },
    restoreUnitWrites() {
      unitWritesFail = false;
    },
  };
}
