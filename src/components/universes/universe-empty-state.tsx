"use client";

import { useEffect, useRef } from "react";
import { en } from "@/messages/en";

// Shown in the central area while the selected universe has no works and no entities (FR-22).
// Text only: creating works is out of scope, so there is no action to offer.
// Focus and the announcement only happen right after the universe was created; selecting an empty
// universe later just shows the state, so it does not steal focus or repeat "Universe created".
type UniverseEmptyStateProps = { universeName: string; wasJustCreated: boolean };

export function UniverseEmptyState({ universeName, wasJustCreated }: UniverseEmptyStateProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const announcementRef = useRef<HTMLDivElement>(null);

  // Focus moves to the heading so keyboard users land on the new content. The live region is
  // rendered empty and filled afterwards, written straight to the DOM, so assistive technologies
  // see a change and announce it.
  useEffect(() => {
    if (!wasJustCreated) return;
    headingRef.current?.focus();
    if (announcementRef.current !== null) {
      announcementRef.current.textContent = en.universeEmptyState.createdAnnouncement(universeName);
    }
  }, [universeName, wasJustCreated]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <h2 ref={headingRef} tabIndex={-1} className="font-serif text-2xl">
        {universeName}
      </h2>
      <p className="text-ink">{en.universeEmptyState.noContentYet}</p>
      <p className="text-ink-muted max-w-prose text-sm">{en.universeEmptyState.nextStepsHint}</p>
      <div ref={announcementRef} role="status" aria-live="polite" className="sr-only" />
    </div>
  );
}
