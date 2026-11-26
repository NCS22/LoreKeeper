import type { ViewerContext } from "@/shared/domain/viewer-context";
import type { EntityRepository } from "../domain/entity-repository";
import { toEntitySummaryDto, type EntitySummaryDto } from "./entity-dto";

export type ListEntitiesDependencies = {
  readonly entityRepository: EntityRepository;
};

/**
 * The entities of the universe of the context, in creation order (ties by identifier), each with
 * its name and type (FR-9). The context exists only after the ownership check, so the universe is
 * always an own universe of the viewer.
 *
 * Temporary exception of spec 006 (2026-11-25): no visibility rule is applied, every entity of the
 * own universe is listed in READER and AUTHOR universes alike, until the Phase 4 spec that filters
 * the reads of spec 006 filters this one by the reading position.
 */
export async function listEntities(
  dependencies: ListEntitiesDependencies,
  viewerContext: ViewerContext,
): Promise<readonly EntitySummaryDto[]> {
  const entities = await dependencies.entityRepository.findAllInUniverse(viewerContext);
  return entities.map(toEntitySummaryDto);
}
