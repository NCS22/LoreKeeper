"use client";

import { useRef, useState } from "react";
import { UserRound } from "lucide-react";
import { signOutAction } from "@/app/actions";
import { AccountFormMessage, updateThenFocus } from "@/components/accounts/account-form-message";
import type { AccountFormVocabulary } from "@/components/accounts/account-issue-messages";
import {
  interpretAccountActionResult,
  type AccountSubmissionOutcome,
} from "@/components/accounts/interpret-account-action-result";
import { leaveAccountPage } from "@/components/accounts/leave-account-page";
import { useAccountSubmission } from "@/components/accounts/use-account-submission";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { en } from "@/messages/en";

type UserMenuProps = {
  /** The display name of the account in use, as stored. Shown as plain text (FR-26). */
  displayName: string;
  /** The email of the account in use, as stored. Shown as plain text (FR-26). */
  email: string;
  /** Where a sign-out goes: the sign-in page with no return destination (FR-27). */
  signInAddress: string;
  /** Field names and issue codes of the account rules, read on the server (plan D13). */
  vocabulary: AccountFormVocabulary;
};

// Keeps the text apart from what surrounds it, so invisible and direction-control characters in a
// name or an email cannot reorder the text around them (FR-26). `bdi` isolates by itself; the
// explicit property makes the intent visible and does not depend on the default style sheet.
const ISOLATED_TEXT_CLASS_NAME = "[unicode-bidi:isolate]";

/**
 * The user menu of the top bar (FR-25 to FR-28). One trigger button at every width opens a panel
 * with the display name and the email in full and the sign-out action; from the `md` breakpoint the
 * trigger also shows the name on one line cut with an ellipsis. Both values are React text nodes,
 * never markup. The state of a sign-out lives here, outside the panel, so it survives the panel
 * being closed while the request waits.
 */
export function UserMenu({ displayName, email, signInAddress, vocabulary }: UserMenuProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [signOutMessage, setSignOutMessage] = useState<string | null>(null);
  const { isSubmitting, runSubmission, releaseSubmission } = useAccountSubmission();
  const signOutMessageRef = useRef<HTMLDivElement>(null);

  function showSignOutFailure(message: string): void {
    updateThenFocus(
      () => {
        setSignOutMessage(message);
        setIsPanelOpen(true);
        releaseSubmission();
      },
      () => signOutMessageRef.current,
    );
  }

  async function handleSignOut(): Promise<void> {
    // The old message goes first, so a repeated message is announced again when it comes back (NFR-2).
    setSignOutMessage(null);

    const submissionOutcome = await runSubmission(() => signOutAction());
    // `null`: a sign-out is already waiting (FR-12).
    if (submissionOutcome === null) return;

    const outcome = interpretAccountActionResult("sign-out", submissionOutcome, vocabulary);
    if (outcome.status === "succeeded" || outcome.status === "already-signed-in") {
      // The control stays in progress: the page is being left (FR-27, plan D6).
      leaveAccountPage(signInAddress);
      return;
    }
    showSignOutFailure(readFailureMessage(outcome));
  }

  return (
    <Popover open={isPanelOpen} onOpenChange={setIsPanelOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="min-w-0">
          <UserRound aria-hidden />
          <span className="sr-only">{en.userMenu.triggerLabel}</span>
          <span className="hidden max-w-48 truncate md:block">
            <bdi className={ISOLATED_TEXT_CLASS_NAME}>{displayName}</bdi>
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label={en.userMenu.panelTitle}>
        <div aria-busy={isSubmitting} className="flex min-w-0 flex-col gap-4">
          <h2 className="font-serif text-lg">{en.userMenu.panelTitle}</h2>
          <dl className="flex min-w-0 flex-col gap-2 text-sm">
            <div className="min-w-0">
              <dt className="sr-only">{en.userMenu.displayNameLabel}</dt>
              <dd className="font-medium [overflow-wrap:anywhere]">
                <bdi className={ISOLATED_TEXT_CLASS_NAME}>{displayName}</bdi>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="sr-only">{en.userMenu.emailLabel}</dt>
              <dd className="text-ink-muted [overflow-wrap:anywhere]">
                <bdi className={ISOLATED_TEXT_CLASS_NAME}>{email}</bdi>
              </dd>
            </div>
          </dl>
          <AccountFormMessage message={signOutMessage} messageRef={signOutMessageRef} />
          <Button variant="secondary" size="sm" disabled={isSubmitting} onClick={handleSignOut} className="self-start">
            {isSubmitting ? en.accountForms.signOut.submitting : en.accountForms.signOut.submit}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** A sign-out has no form fields, so anything but a general message is shown as the general failure (FR-9). */
function readFailureMessage(outcome: AccountSubmissionOutcome): string {
  return outcome.status === "message" ? outcome.message : en.accountForms.generalFailure;
}
