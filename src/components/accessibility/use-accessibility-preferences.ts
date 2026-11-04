"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_PREFERENCES,
  type AccessibilityPreferences,
  type BackgroundPresetId,
  type TextPresetId,
} from "@/components/accessibility/presets";
import {
  getPreferencesSnapshot,
  getServerPreferencesSnapshot,
  savePreferences,
  subscribeToPreferences,
} from "@/components/accessibility/preferences-store";

export function useAccessibilityPreferences() {
  const preferences = useSyncExternalStore(
    subscribeToPreferences,
    getPreferencesSnapshot,
    getServerPreferencesSnapshot,
  );

  const update = useCallback((changes: Partial<AccessibilityPreferences>) => {
    savePreferences({ ...getPreferencesSnapshot(), ...changes });
  }, []);

  return {
    preferences,
    setBackground: useCallback((background: BackgroundPresetId) => update({ background }), [update]),
    setText: useCallback((text: TextPresetId) => update({ text }), [update]),
    setTextScalePercent: useCallback((textScalePercent: number) => update({ textScalePercent }), [update]),
    resetPreferences: useCallback(() => savePreferences(DEFAULT_PREFERENCES), []),
  };
}
