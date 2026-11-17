import { en } from "@/messages/en";

// Shown while the universes load. It carries no universe data.
export function WorkspaceLoading() {
  return (
    <div role="status" className="text-ink-muted flex h-dvh items-center justify-center text-sm">
      {en.workspace.loadingUniverses}
    </div>
  );
}
