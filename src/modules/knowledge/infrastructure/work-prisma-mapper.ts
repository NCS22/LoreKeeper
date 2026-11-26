import type { Work as StoredWork } from "@/shared/infrastructure/generated/prisma/client";
import type { Work } from "../domain/work";

/** A stored work row with the number of its units that are not deleted. */
export type StoredWorkWithUnitCount = StoredWork & { readonly _count: { readonly units: number } };

/**
 * Turns a stored row into the domain work. Generated types never leave this folder. The stored
 * medium is the PostgreSQL enum `WorkMedium`, whose values the type checker matches with the domain
 * media, so no unknown value can arrive here.
 */
export function toDomainWork(storedWork: StoredWorkWithUnitCount): Work {
  return {
    id: storedWork.id,
    universeId: storedWork.universeId,
    title: storedWork.title,
    medium: storedWork.medium,
    unitCount: storedWork._count.units,
    createdAt: storedWork.createdAt,
    updatedAt: storedWork.updatedAt,
  };
}
