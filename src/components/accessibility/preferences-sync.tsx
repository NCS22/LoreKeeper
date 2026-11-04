"use client";

import { useEffect } from "react";
import { useAccessibilityPreferences } from "@/components/accessibility/use-accessibility-preferences";

// Mirrors the preferences onto <html>; tokens.css reacts to these attributes and the variable.
export function PreferencesSync() {
  const { preferences } = useAccessibilityPreferences();

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.bg = preferences.background;
    root.dataset.text = preferences.text;
    root.style.setProperty("--text-scale", String(preferences.textScalePercent / 100));
  }, [preferences]);

  return null;
}
