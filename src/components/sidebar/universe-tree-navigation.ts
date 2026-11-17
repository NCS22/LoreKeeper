/**
 * Where the keyboard focus goes from a universe of the navigation tree, for the keys that move it
 * (the WAI-ARIA tree pattern, one level). Returns `null` when the key moves nothing: the first row
 * has nothing above it, the last has nothing below it, and other keys are not for the tree.
 */
export function findUniverseIdToFocus(
  universeIds: readonly string[],
  currentUniverseId: string,
  key: string,
): string | null {
  const currentIndex = universeIds.indexOf(currentUniverseId);
  if (currentIndex === -1) return null;

  switch (key) {
    case "ArrowDown":
      return universeIds[currentIndex + 1] ?? null;
    case "ArrowUp":
      return universeIds[currentIndex - 1] ?? null;
    case "Home":
      return universeIds[0] ?? null;
    case "End":
      return universeIds[universeIds.length - 1] ?? null;
    default:
      return null;
  }
}

/**
 * The one universe the tree offers as a tab stop: the one focused last, else the selected one, else
 * the first. Null when the list is empty.
 */
export function chooseTabbableUniverseId(
  universeIds: readonly string[],
  lastFocusedUniverseId: string | null,
  selectedUniverseId: string | null,
): string | null {
  if (lastFocusedUniverseId !== null && universeIds.includes(lastFocusedUniverseId)) return lastFocusedUniverseId;
  if (selectedUniverseId !== null && universeIds.includes(selectedUniverseId)) return selectedUniverseId;
  return universeIds[0] ?? null;
}
