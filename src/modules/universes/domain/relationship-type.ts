/**
 * A kind of relationship of one universe's catalog: a label read from the source entity and an
 * inverse label read from the target entity (the same text when the type is symmetric). The
 * repository only ever hands out types that are not deleted.
 */
export type RelationshipType = {
  readonly id: string;
  readonly universeId: string;
  readonly key: string;
  readonly label: string;
  readonly inverseLabel: string;
  readonly isSymmetric: boolean;
  readonly isPredefined: boolean;
};
