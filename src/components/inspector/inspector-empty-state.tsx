import { en } from "@/messages/en";

// The details panel while no universe is selected: events, sources and reading positions arrive in
// future versions (004 FR-15, changed by spec 006 FR-10). Text only.
export function InspectorEmptyState() {
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-4">
      <h3 className="font-serif text-lg">{en.inspector.emptyTitle}</h3>
      <p className="text-ink-muted text-sm">{en.inspector.emptyText}</p>
    </div>
  );
}
