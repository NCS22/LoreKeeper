import type { RelationshipType } from "./relationship-type";

/** What a predefined type is before it belongs to a universe. */
export type PredefinedRelationshipType = Pick<
  RelationshipType,
  "key" | "label" | "inverseLabel" | "isSymmetric"
>;

/**
 * The eight relationship types every universe has from its creation (spec 006, FR-3; OD-16 decided
 * on 2026-11-25). A symmetric type reads the same from both entities, so its inverse label is its
 * label. The migration `create_knowledge_items` writes the same list for the universes that existed
 * before it; a database test pins both to the same list.
 */
export const PREDEFINED_RELATIONSHIP_TYPES: readonly PredefinedRelationshipType[] = [
  { key: "MEMBER_OF", label: "member of", inverseLabel: "has member", isSymmetric: false },
  { key: "LEADER_OF", label: "leader of", inverseLabel: "led by", isSymmetric: false },
  { key: "ALLY_OF", label: "ally of", inverseLabel: "ally of", isSymmetric: true },
  { key: "ENEMY_OF", label: "enemy of", inverseLabel: "enemy of", isSymmetric: true },
  { key: "PARENT_OF", label: "parent of", inverseLabel: "child of", isSymmetric: false },
  { key: "SIBLING_OF", label: "sibling of", inverseLabel: "sibling of", isSymmetric: true },
  { key: "LOCATED_IN", label: "located in", inverseLabel: "contains", isSymmetric: false },
  { key: "POSSESSES", label: "possesses", inverseLabel: "possessed by", isSymmetric: false },
];
