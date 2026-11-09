import type { Metadata } from "next";
import { AccountPageShell } from "@/components/accounts/account-page-shell";
import { en } from "@/messages/en";
import { TryAgainButton } from "./_components/try-again-button";

export const metadata: Metadata = {
  title: `${en.sessionCheckFailed.metadataTitle} - ${en.app.name}`,
};

/**
 * The page the proxy rewrites to when the session of a request cannot be checked (FR-24). It has no
 * workspace content and no user menu, since who the person is stays unknown, and it never says the
 * person is signed out. The root layout gives it the design tokens and the accessibility preferences.
 */
export default function SessionCheckFailedPage() {
  return (
    <AccountPageShell title={en.sessionCheckFailed.title}>
      <p className="text-ink text-sm">{en.sessionCheckFailed.description}</p>
      <div>
        <TryAgainButton />
      </div>
    </AccountPageShell>
  );
}
