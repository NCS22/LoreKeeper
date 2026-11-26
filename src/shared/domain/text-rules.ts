/**
 * Whether a text is storable: it has no null character and no invalid Unicode sequence
 * (a lone surrogate). PostgreSQL cannot store the first and would silently replace the
 * second, so both are refused before storage.
 */
export function isStorableText(text: string): boolean {
  return !text.includes("\u0000") && text.isWellFormed();
}

/** Characters are counted as Unicode code points, so an emoji counts as one. */
export function countTextCharacters(text: string): number {
  return Array.from(text).length;
}
