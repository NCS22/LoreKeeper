import type { RelatedEntity } from "./relationship";

/** The entity a relationship is seen from: its source or its target. */
export type RelationshipSide = "SOURCE" | "TARGET";

/** The two ends of a directed relationship. */
export type RelationshipEnds = {
  readonly source: RelatedEntity;
  readonly target: RelatedEntity;
};

/** The wording of a relationship type: its label, its inverse label and whether it is symmetric. */
export type RelationshipTypeWording = {
  readonly label: string;
  readonly inverseLabel: string;
  readonly isSymmetric: boolean;
};

/** "<subject> — <label> → <other>", the text of a relationship seen from one of its entities. */
export type RelationshipReading = {
  readonly subjectName: string;
  readonly label: string;
  readonly otherName: string;
};

/**
 * The reading of a relationship from one of its two entities (spec 006, Definitions): from the
 * source, "<source> — <label> → <target>"; from the target, "<target> — <inverse label> → <source>".
 * A symmetric type reads with its label from both entities, so both readings have the same text.
 */
export function readRelationshipFromSide(
  relationshipEnds: RelationshipEnds,
  typeWording: RelationshipTypeWording,
  side: RelationshipSide,
): RelationshipReading {
  if (side === "SOURCE") {
    return {
      subjectName: relationshipEnds.source.name,
      label: typeWording.label,
      otherName: relationshipEnds.target.name,
    };
  }

  return {
    subjectName: relationshipEnds.target.name,
    label: typeWording.isSymmetric ? typeWording.label : typeWording.inverseLabel,
    otherName: relationshipEnds.source.name,
  };
}
