"use client";

import { useSyncExternalStore } from "react";

// Same breakpoint as Tailwind's md: below it the side panels become drawers.
const DESKTOP_QUERY = "(min-width: 48rem)";

function subscribeToBreakpoint(onChange: () => void): () => void {
  const mediaQuery = window.matchMedia(DESKTOP_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

// The server renders the desktop layout, and a narrow screen switches right after hydration.
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeToBreakpoint,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}
