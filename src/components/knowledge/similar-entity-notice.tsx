"use client";

import { en } from "@/messages/en";
import { useKnowledge } from "@/components/knowledge/knowledge-provider";

// The notice of FR-6, next to the result of an entity creation: it names the oldest entity of the same
// type with the same comparable name and never blocked the creation. The provider keeps it until another
// form is opened, another entity is selected or the selected universe changes, also for a late answer.
// The live region is always in the page, so the notice is announced when its text appears.
export function SimilarEntityNotice() {
  const { similarEntityName } = useKnowledge();

  return (
    <div role="status" aria-live="polite" className={similarEntityName === null ? "sr-only" : "border-line border-b px-3 py-2"}>
      {similarEntityName === null ? null : (
        <p className="text-ink min-w-0 text-sm [overflow-wrap:anywhere]">
          {en.entityCreation.similarEntityNotice(similarEntityName)}
        </p>
      )}
    </div>
  );
}
