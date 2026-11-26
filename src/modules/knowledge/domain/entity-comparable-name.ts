import { toComparableText } from "@/shared/domain/comparable-text";

/**
 * The comparable name of an entity (spec 006, Definitions): made comparable like the name of a
 * universe, so case, accents, spacing and Unicode composition are ignored. It is stored as
 * `normalizedName` and used by the duplicate-name notice (FR-6, D11).
 */
export function toComparableEntityName(name: string): string {
  return toComparableText(name);
}
