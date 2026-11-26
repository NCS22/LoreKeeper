import type { RelationshipType } from "../domain/relationship-type";

/** A relationship type as seen outside the module: no universe, no predefined flag. */
export type RelationshipTypeDto = {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly inverseLabel: string;
  readonly isSymmetric: boolean;
};

export function toRelationshipTypeDto(relationshipType: RelationshipType): RelationshipTypeDto {
  return {
    id: relationshipType.id,
    key: relationshipType.key,
    label: relationshipType.label,
    inverseLabel: relationshipType.inverseLabel,
    isSymmetric: relationshipType.isSymmetric,
  };
}
