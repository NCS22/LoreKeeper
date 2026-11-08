import type { Metadata } from "next";
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
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="bg-surface border-line rounded-popover shadow-popover flex w-full max-w-md min-w-0 flex-col gap-6 border p-6">
        <div className="flex flex-col gap-1">
          <p className="text-ink-muted text-sm font-medium">{en.app.name}</p>
          <h1 className="text-xl">{en.sessionCheckFailed.title}</h1>
        </div>
        <p className="text-ink text-sm">
          {en.sessionCheckFailed.description}
        </p>
        <div>
          <TryAgainButton />
        </div>
      </div>
    </main>
  );
}
