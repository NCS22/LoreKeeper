import {
  BACKGROUND_PRESET_IDS,
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  TEXT_PRESET_IDS,
  TEXT_SCALE_MAX_PERCENT,
  TEXT_SCALE_MIN_PERCENT,
  type AccessibilityPreferences,
} from "@/accessibility/presets";

// External store read through useSyncExternalStore: the server renders the defaults and the
// client adopts the stored values right after hydration without a mismatch.

type Listener = () => void;

const listeners = new Set<Listener>();
let currentPreferences: AccessibilityPreferences | null = null;

function readStoredValue(): string | null {
  try {
    return window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
  } catch {
    // Storage is blocked in some private windows; the defaults apply and changes live in memory.
    return null;
  }
}

function parseStoredPreferences(storedValue: string | null): AccessibilityPreferences {
  if (storedValue === null) return DEFAULT_PREFERENCES;
  let parsedValue: Partial<Record<keyof AccessibilityPreferences, unknown>> | null;
  try {
    parsedValue = JSON.parse(storedValue);
  } catch {
    // A corrupted value falls back to the defaults and is overwritten on the next change.
    return DEFAULT_PREFERENCES;
  }
  const { background, text, textScalePercent } = parsedValue ?? {};
  return {
    background: BACKGROUND_PRESET_IDS.find((id) => id === background) ?? DEFAULT_PREFERENCES.background,
    text: TEXT_PRESET_IDS.find((id) => id === text) ?? DEFAULT_PREFERENCES.text,
    textScalePercent:
      typeof textScalePercent === "number" &&
      textScalePercent >= TEXT_SCALE_MIN_PERCENT &&
      textScalePercent <= TEXT_SCALE_MAX_PERCENT
        ? textScalePercent
        : DEFAULT_PREFERENCES.textScalePercent,
  };
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function getPreferencesSnapshot(): AccessibilityPreferences {
  if (currentPreferences === null) currentPreferences = parseStoredPreferences(readStoredValue());
  return currentPreferences;
}

export function getServerPreferencesSnapshot(): AccessibilityPreferences {
  return DEFAULT_PREFERENCES;
}

export function subscribeToPreferences(listener: Listener): () => void {
  listeners.add(listener);
  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== PREFERENCES_STORAGE_KEY) return;
    currentPreferences = parseStoredPreferences(event.newValue);
    notifyListeners();
  };
  window.addEventListener("storage", handleStorageEvent);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorageEvent);
  };
}

export function savePreferences(nextPreferences: AccessibilityPreferences) {
  currentPreferences = nextPreferences;
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(nextPreferences));
  } catch {
    // Not persisted (blocked storage); the preference still applies for this visit.
  }
  notifyListeners();
}
