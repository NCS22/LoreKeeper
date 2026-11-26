/**
 * The form used to decide whether two names are "the same": letter case, accents,
 * surrounding or repeated whitespace and the composed or decomposed form of a character
 * are ignored.
 */
export function toComparableText(text: string): string {
  return text
    .normalize("NFC")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, " ");
}
