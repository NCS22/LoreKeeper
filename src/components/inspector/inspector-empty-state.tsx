import { en } from "@/messages/en";

// The details panel while there is nothing to detail: knowledge, relationships, events, sources and
// reading positions arrive in future versions (FR-15). Text only.
export function InspectorEmptyState() {
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-4">
      <h3 className="font-serif text-lg">{en.inspector.emptyTitle}</h3>
      <p className="text-ink-muted text-sm">{en.inspector.emptyText}</p>
    </div>
  );
}
