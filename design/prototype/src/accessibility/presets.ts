export const BACKGROUND_PRESET_IDS = ["obsidian", "midnight", "nocturne", "parchment"] as const;
export type BackgroundPresetId = (typeof BACKGROUND_PRESET_IDS)[number];

export const TEXT_PRESET_IDS = ["vellum", "ash", "bright"] as const;
export type TextPresetId = (typeof TEXT_PRESET_IDS)[number];

export type AccessibilityPreferences = {
  background: BackgroundPresetId;
  text: TextPresetId;
  textScalePercent: number;
};

export const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  background: "obsidian",
  text: "vellum",
  textScalePercent: 100,
};

export const TEXT_SCALE_MIN_PERCENT = 87.5;
export const TEXT_SCALE_MAX_PERCENT = 137.5;
export const TEXT_SCALE_STEP_PERCENT = 2.5;

// In the real app these preferences are stored per user; the prototype keeps them in this browser.
export const PREFERENCES_STORAGE_KEY = "lorekeeper.prototype.accessibility";
