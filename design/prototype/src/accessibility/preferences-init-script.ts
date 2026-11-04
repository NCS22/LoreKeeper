import {
  BACKGROUND_PRESET_IDS,
  PREFERENCES_STORAGE_KEY,
  TEXT_PRESET_IDS,
  TEXT_SCALE_MAX_PERCENT,
  TEXT_SCALE_MIN_PERCENT,
} from "@/accessibility/presets";

// Runs inline in <head> before the first paint so stored preferences never flash the defaults.
export const PREFERENCES_INIT_SCRIPT = `(function () {
  try {
    var stored = window.localStorage.getItem(${JSON.stringify(PREFERENCES_STORAGE_KEY)});
    if (!stored) return;
    var preferences = JSON.parse(stored);
    var root = document.documentElement;
    if (${JSON.stringify(BACKGROUND_PRESET_IDS)}.indexOf(preferences.background) !== -1) root.dataset.bg = preferences.background;
    if (${JSON.stringify(TEXT_PRESET_IDS)}.indexOf(preferences.text) !== -1) root.dataset.text = preferences.text;
    var scale = preferences.textScalePercent;
    if (typeof scale === "number" && scale >= ${TEXT_SCALE_MIN_PERCENT} && scale <= ${TEXT_SCALE_MAX_PERCENT}) {
      root.style.setProperty("--text-scale", String(scale / 100));
    }
  } catch (error) {
    // Unreadable storage keeps the defaults rendered by the server.
  }
})();`;
