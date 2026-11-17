import { en } from "@/messages/en";

// The graph view while no entity or relationship can exist: text only, nothing to click (FR-15).
export function GraphEmptyState() {
  return (
    <section aria-label={en.center.graphView} className="border-line min-w-0 rounded-control border border-dashed p-4">
      <p className="text-ink-muted text-sm">{en.graph.emptyText}</p>
    </section>
  );
}
