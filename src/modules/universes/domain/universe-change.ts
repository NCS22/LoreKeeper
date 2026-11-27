import type { Universe } from "./universe";

type StoredUniverseTexts = Pick<Universe, "name" | "description">;

/**
 * Whether an edit really changes the name or the description of a stored universe. Both
 * texts are compared trimmed and in their Unicode composed form (NFC), so whitespace at the
 * ends and the composed or decomposed form of the same text are no change, while case,
 * accents and inner spacing are. A description that is empty or only whitespace counts as no
 * description. The edited values are expected to be validated already; trimming here again
 * keeps the rule complete on its own.
 */
export function isRealUniverseChange(
  storedUniverse: StoredUniverseTexts,
  validatedName: string,
  validatedDescription: string | null,
): boolean {
  const isNameChanged =
    toComparedUniverseText(storedUniverse.name) !== toComparedUniverseText(validatedName);
  const isDescriptionChanged =
    toComparedUniverseDescription(storedUniverse.description) !==
    toComparedUniverseDescription(validatedDescription);

  return isNameChanged || isDescriptionChanged;
}

function toComparedUniverseText(text: string): string {
  return text.trim().normalize("NFC");
}

function toComparedUniverseDescription(description: string | null): string | null {
  const comparedDescription = toComparedUniverseText(description ?? "");

  return comparedDescription.length === 0 ? null : comparedDescription;
}
