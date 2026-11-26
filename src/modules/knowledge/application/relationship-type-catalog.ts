import type { ViewerContext } from "@/shared/domain/viewer-context";

/** A relationship type as seen outside the module: no universe, no predefined flag. */
export type RelationshipTypeDto = {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly inverseLabel: string;
  readonly isSymmetric: boolean;
};

/**
 * Port to the universes module, which owns the catalog (plan D2): the relationship types of the
 * universe of the context, ordered by key. The context exists only after the ownership check. The
 * composition implements it with the public interface of the universes module, for the acting user
 * of the operation (decision D-T4-1).
 */
export type RelationshipTypeCatalog = {
  listRelationshipTypes(viewerContext: ViewerContext): Promise<readonly RelationshipTypeDto[]>;
};
