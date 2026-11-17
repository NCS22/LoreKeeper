import { en } from "@/messages/en";

// The entity list while no entity can exist: text only, nothing to click (FR-15).
export function EntityListEmptyState() {
  return (
    <section aria-label={en.center.listView} className="border-line min-w-0 rounded-control border border-dashed p-4">
      <p className="text-ink-muted text-sm">{en.entityList.emptyText}</p>
    </section>
  );
}
