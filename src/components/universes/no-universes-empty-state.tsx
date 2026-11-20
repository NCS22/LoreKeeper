"use client";

import type { RefObject } from "react";
import { en } from "@/messages/en";
import { Button } from "@/components/ui/button";

type NoUniversesEmptyStateProps = {
  onCreateFirstUniverse: () => void;
  // Owned by the central area, which returns the focus here when the creation form is cancelled.
  createButtonRef: RefObject<HTMLButtonElement | null>;
};

// Shown while the account has no universe (FR-16): says so and offers the one action that exists.
// The wording does not name a panel, because on a narrow screen the universes are in a drawer.
export function NoUniversesEmptyState({ onCreateFirstUniverse, createButtonRef }: NoUniversesEmptyStateProps) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-3">
      <h1 className="font-serif text-2xl">{en.noUniversesEmptyState.title}</h1>
      <p className="text-ink-muted max-w-prose text-sm">{en.noUniversesEmptyState.text}</p>
      <Button ref={createButtonRef} onClick={onCreateFirstUniverse}>
        {en.noUniversesEmptyState.createFirstUniverse}
      </Button>
    </div>
  );
}
