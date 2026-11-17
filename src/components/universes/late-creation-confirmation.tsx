"use client";

import { en } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { CREATION_NOTICE_CODES } from "@/components/universes/universe-creation-state";
import { useUniverses } from "@/components/universes/universes-provider";

// The answer of a creation that was thought lost arrived and the universe exists (FR-8). The success
// closes the form, so this message lives in the workspace, where the person is now. It replaces the
// unknown-result message and goes when the person dismisses it or starts another creation.
export function LateCreationConfirmation() {
  const { creationNoticeCode, dismissCreationNotice } = useUniverses();
  if (creationNoticeCode !== CREATION_NOTICE_CODES.confirmedAfterDelay) return null;

  return (
    <div className="border-line flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2">
      <p role="status" data-message-code={creationNoticeCode} className="text-ink min-w-0 flex-1 text-sm">
        {en.universeCreation.notices.confirmedAfterDelay}
      </p>
      <Button type="button" variant="secondary" onClick={dismissCreationNotice}>
        {en.universeCreation.notices.dismiss}
      </Button>
    </div>
  );
}
