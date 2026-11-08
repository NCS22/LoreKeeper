import type { ReactNode } from "react";
import { en } from "@/messages/en";

type AccountPageShellProps = {
  title: string;
  children: ReactNode;
};

/**
 * The frame of the sign-up and sign-in pages: the main landmark, the brand, the one `h1` of the
 * page and the card that holds the form. A Server Component; it holds no state.
 */
export function AccountPageShell({ title, children }: AccountPageShellProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="bg-surface border-line rounded-popover shadow-popover flex w-full max-w-md min-w-0 flex-col gap-6 border p-6">
        <div className="flex flex-col gap-1">
          <p className="text-ink-muted text-sm font-medium">{en.app.name}</p>
          <h1 className="text-xl">{title}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
