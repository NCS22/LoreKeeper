export const UNIVERSE_MODES = ["READER", "AUTHOR"] as const;

export type UniverseMode = (typeof UNIVERSE_MODES)[number];

export const DEFAULT_UNIVERSE_MODE: UniverseMode = "READER";

/** Returns the mode when the value is exactly one of the known modes, otherwise `null`. */
export function parseUniverseMode(value: unknown): UniverseMode | null {
  return UNIVERSE_MODES.find((mode) => mode === value) ?? null;
}
