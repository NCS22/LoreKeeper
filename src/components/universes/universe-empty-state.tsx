"use client";

import { useEffect, useRef, type RefObject } from "react";
import { en } from "@/messages/en";
import { UniverseNameText } from "@/components/universes/universe-name-text";
import type { UniverseDto } from "@/modules/universes";

// Shown in the central area for the selected universe, above its view. It shows what the person
// entered, so it can be seen that it was kept (name, mode and description, as plain text). The text
// that said the universe is empty is gone (spec 006): the works area and the entity list say what
// the universe has.
// Focus and the announcement only happen right after the universe was created; selecting an empty
// universe later just shows the state, so it does not steal focus or repeat "Universe created".
type UniverseEmptyStateProps = {
  universe: UniverseDto;
  wasJustCreated: boolean;
  // Owned by the central area, which also moves the focus here when the creation form is cancelled.
  headingRef: RefObject<HTMLHeadingElement | null>;
};

export function UniverseEmptyState({ universe, wasJustCreated, headingRef }: UniverseEmptyStateProps) {
  const announcementRef = useRef<HTMLDivElement>(null);
  const mode = en.universeCreation.modes[universe.mode];

  // Focus moves to the heading so keyboard users land on the new content. The live region is
  // rendered empty and filled afterwards, written straight to the DOM, so assistive technologies
  // see a change and announce it.
  useEffect(() => {
    if (!wasJustCreated) return;
    headingRef.current?.focus();
    if (announcementRef.current !== null) {
      announcementRef.current.textContent = en.universeEmptyState.createdAnnouncement(universe.name);
    }
  }, [universe.name, wasJustCreated, headingRef]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h1 ref={headingRef} tabIndex={-1} className="font-serif text-2xl">
        <UniverseNameText text={universe.name} />
      </h1>
      <div>
        <p className="text-sm">
          <span className="text-ink-muted">{en.universeEmptyState.modeLabel} </span>
          <span className="font-medium">{mode.label}</span>
        </p>
        <p className="text-ink-muted text-sm">{mode.explanation}</p>
      </div>
      {universe.description === null ? null : (
        <p className="text-sm">
          <UniverseNameText text={universe.description} className="whitespace-pre-line" />
        </p>
      )}
      <div ref={announcementRef} role="status" aria-live="polite" className="sr-only" />
    </div>
  );
}
