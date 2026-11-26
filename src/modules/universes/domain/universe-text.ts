import { countTextCharacters, isStorableText } from "@/shared/domain/text-rules";

/**
 * Whether a text is storable: it has no null character and no invalid Unicode sequence
 * (a lone surrogate). PostgreSQL cannot store the first and would silently replace the
 * second, so both are refused before storage (FR-5). The rule is the shared one.
 */
export function isValidUniverseText(text: string): boolean {
  return isStorableText(text);
}

/** Characters are counted as Unicode code points, so an emoji counts as one (the shared count). */
export function countUniverseTextCharacters(text: string): number {
  return countTextCharacters(text);
}
