import type { Entity } from "../domain/entity";
import type { EntityType } from "../domain/entity-type";

/** An entity as the list shows it outside the module: no universe, no point. Dates are ISO 8601 in UTC. */
export type EntitySummaryDto = {
  readonly id: string;
  readonly name: string;
  readonly type: EntityType;
  readonly createdAt: string;
};

export function toEntitySummaryDto(entity: Entity): EntitySummaryDto {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    createdAt: entity.createdAt.toISOString(),
  };
}
