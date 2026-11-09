"use client";

import { AccountPageShell } from "@/components/accounts/account-page-shell";
import { Button } from "@/components/ui/button";
import { en } from "@/messages/en";

type ErrorPageProps = {
  /** Received from the framework and deliberately never shown: it can carry internal detail. */
  error: unknown;
  /** Asks the server for the page again and renders it in place of this one. */
  retry: () => void;
};

/**
 * The boundary for an error while a page renders after the guard admitted the request, for example
 * the user menu failing to read the account because the stored data failed (FR-24). Same look as the
 * session-check-failed page: no workspace content, no user menu (the session is unknown), no error
 * text, and it never treats the person as signed out. "Try again" uses `retry`, which fetches the
 * page again; `reset` would only re-render the payload that already failed.
 */
export default function ErrorPage({ retry }: ErrorPageProps) {
  return (
    <AccountPageShell title={en.errorPage.title}>
      <p className="text-ink text-sm">{en.errorPage.description}</p>
      <div>
        <Button type="button" onClick={() => retry()}>
          {en.errorPage.tryAgain}
        </Button>
      </div>
    </AccountPageShell>
  );
}
