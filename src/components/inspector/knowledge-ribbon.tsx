import { BookMarked } from "lucide-react";
import { en } from "@/messages/en";
import { StatusBadge } from "@/components/entities/status-badge";
import type { KnowledgeEntryDto } from "@/mocks/dto/entity";

// The folio: fragments in the order they are revealed, each glossed in the margin with the point
// of the work where it appears, along a ribbon that reads like the story does.
export function KnowledgeRibbon({ entries }: { entries: readonly KnowledgeEntryDto[] }) {
  if (entries.length === 0) {
    return <p className="text-ink-muted">{en.inspector.noKnowledge}</p>;
  }

  return (
    <ol className="flex flex-col">
      {entries.map((entry) => (
        <li key={entry.id} className="grid grid-cols-[4.75rem_1fr] gap-x-4">
          <p className="text-ink-muted pt-0.5 text-right font-serif text-sm leading-snug italic">
            <span className="sr-only">{en.inspector.revealedAt} </span>
            {entry.revealedAt.label}
          </p>
          <div className="border-line-control relative border-l pb-5 pl-4 last:pb-0">
            <span aria-hidden className="bg-ink absolute top-2 -left-[3.5px] size-1.5 rounded-pill" />
            <p className="max-w-[var(--reading-measure)] font-serif text-base leading-relaxed">{entry.content}</p>
            <div className="mt-1.5 flex flex-col items-start gap-1">
              <StatusBadge status={entry.status} />
              {entry.citations.map((citation) => (
                <span
                  key={`${citation.sourceId}-${citation.locator ?? ""}`}
                  className="text-ink-muted flex items-baseline gap-1 text-xs"
                >
                  <BookMarked aria-hidden className="size-3 shrink-0 translate-y-0.5" />
                  <span>
                    {citation.sourceTitle}
                    {citation.locator !== null && `, ${citation.locator}`}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
