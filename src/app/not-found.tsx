import type { Metadata } from "next";
import Link from "next/link";
import { MinimalTopbar } from "@/components/topbar/minimal-topbar";
import { Button } from "@/components/ui/button";
import { en } from "@/messages/en";

export const metadata: Metadata = {
  title: `${en.notFound.metadataTitle} - ${en.app.name}`,
};

/**
 * The page for an address that does not exist (FR-23). A signed-out person never sees it: the guard
 * sends them to sign in first, like for any other workspace address. It carries the reduced top bar
 * (brand, accessibility control and the user menu, so the person can sign out from here) and a link
 * back to the workspace root. The root layout gives it the design tokens and the preferences.
 */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MinimalTopbar />
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="bg-surface border-line rounded-popover shadow-popover flex w-full max-w-md min-w-0 flex-col gap-6 border p-6">
          <div className="flex flex-col gap-1">
            <p className="text-ink-muted text-sm font-medium">{en.app.name}</p>
            <h1 className="text-xl">{en.notFound.title}</h1>
          </div>
          <p className="text-ink text-sm">{en.notFound.description}</p>
          <div>
            <Button asChild>
              <Link href="/" prefetch={false}>
                {en.notFound.backToWorkspace}
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
