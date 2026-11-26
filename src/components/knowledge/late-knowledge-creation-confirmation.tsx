"use client";

import { en } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { useKnowledge } from "@/components/knowledge/knowledge-provider";
import { CREATION_NOTICE_CODES } from "@/components/universes/universe-creation-state";

// The answer of a work or entity creation that was thought lost arrived and the item exists (004 FR-8
// applied to spec 006). The success closes the form, so this message lives in the workspace. It is shown
// only in the universe the item was created in, and goes when dismissed or when another form opens.
export function LateKnowledgeCreationConfirmation() {
  const { creationNoticeCode, creationKind, dismissCreationNotice } = useKnowledge();
  if (creationNoticeCode !== CREATION_NOTICE_CODES.confirmedAfterDelay) return null;
  const notices = creationKind === "entity" ? en.entityCreation.notices : en.workCreation.notices;

  return (
    <div className="border-line flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2">
      <p role="status" data-message-code={creationNoticeCode} className="text-ink min-w-0 flex-1 text-sm">
        {notices.confirmedAfterDelay}
      </p>
      <Button type="button" variant="secondary" onClick={dismissCreationNotice}>
        {notices.dismiss}
      </Button>
    </div>
  );
}
