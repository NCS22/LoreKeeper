import type { RelationshipTypeCatalog } from "@/modules/knowledge/application/relationship-type-catalog";
import { toRelationshipTypeDto } from "@/modules/universes/application/relationship-type-dto";
import type { RelationshipTypeRepository } from "@/modules/universes/domain/relationship-type-repository";

/**
 * The catalog port of the knowledge module read through the relationship type repository of the
 * universes module, scoped by the viewer as owner, as the composition reads it through the public
 * interface of that module (fake and PostgreSQL storages alike).
 */
export function createRelationshipTypeCatalogOverRepository(
  relationshipTypeRepository: RelationshipTypeRepository,
): RelationshipTypeCatalog {
  return {
    async listRelationshipTypes(viewerContext) {
      const relationshipTypes = await relationshipTypeRepository.findAllInOwnedUniverse(
        viewerContext.viewerUserId,
        viewerContext.universeId,
      );
      return relationshipTypes.map(toRelationshipTypeDto);
    },
  };
}
