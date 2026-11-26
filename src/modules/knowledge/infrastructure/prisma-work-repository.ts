import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import type { WorkRepository } from "../domain/work-repository";
import { runKnowledgeStorageOperation } from "./run-knowledge-storage-operation";
import { toDomainWork } from "./work-prisma-mapper";

/**
 * Works and their units in PostgreSQL. Every query is limited to one universe and leaves out
 * deleted rows. The ownership of that universe is checked before, by the use cases, through the
 * universes module; this repository never reads the universes table. The client is asked for on
 * each call, so building the repository touches nothing.
 */
export function createPrismaWorkRepository(getPrismaClient: () => PrismaClient): WorkRepository {
  return {
    add(newWork) {
      return runKnowledgeStorageOperation("store a work with its units", async () => {
        // One nested write, so one transaction: the work and all its units, or nothing (FR-1).
        await getPrismaClient().work.create({
          data: {
            id: newWork.id,
            universeId: newWork.universeId,
            title: newWork.title,
            medium: newWork.medium,
            createdAt: newWork.createdAt,
            updatedAt: newWork.updatedAt,
            units: {
              createMany: {
                data: newWork.units.map((unit) => ({
                  ordinal: unit.ordinal,
                  label: unit.label,
                  createdAt: newWork.createdAt,
                  updatedAt: newWork.createdAt,
                })),
              },
            },
          },
        });
      });
    },
    // Temporary exception of spec 006 (2026-11-25): no visibility rule, every work of the own
    // universe is returned in READER and AUTHOR universes alike; it ends with the Phase 4 spec that
    // filters the reads of spec 006 (works and units stay visible as structure).
    findAllInUniverse(viewerContext) {
      return runKnowledgeStorageOperation("list the works of a universe", async () => {
        const storedWorks = await getPrismaClient().work.findMany({
          where: { universeId: viewerContext.universeId, deletedAt: null },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: { _count: { select: { units: { where: { deletedAt: null } } } } },
        });
        return storedWorks.map(toDomainWork);
      });
    },
    // Works and units are structure, visible in the final design as well (temporary exception of
    // spec 006 aside): the lookup finds the unit labelled with the number in a work of the universe.
    findBoundaryOfUnitNumber(viewerContext, workId, unitNumber) {
      return runKnowledgeStorageOperation("find a unit of a work", async () => {
        const storedUnit = await getPrismaClient().narrativeUnit.findFirst({
          where: {
            label: String(unitNumber),
            deletedAt: null,
            work: { id: workId, universeId: viewerContext.universeId, deletedAt: null },
          },
          orderBy: { ordinal: "asc" },
          select: { id: true, workId: true },
        });
        return storedUnit === null ? null : { workId: storedUnit.workId, unitId: storedUnit.id };
      });
    },
  };
}
