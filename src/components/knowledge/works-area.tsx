"use client";

import { useId } from "react";
import { Plus } from "lucide-react";
import { en } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { useKnowledge } from "@/components/knowledge/knowledge-provider";
import { UniverseNameText } from "@/components/universes/universe-name-text";
import type { WorkDto } from "@/modules/knowledge";

const MEDIUM_LABELS: Readonly<Record<string, string>> = en.knowledge.mediums;
const UNIT_WORDING_TEXTS: Readonly<Record<string, { singular: string; plural: string }>> = en.knowledge.unitWordings;

type WorksAreaProps = {
  onAddWork: () => void;
};

// The works area of the navigation for the selected universe (spec 006, FR-2): its works in creation
// order, an honest empty state while it has none, and the way to open the work form, always reachable.
export function WorksArea({ onAddWork }: WorksAreaProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="border-line flex min-w-0 flex-col gap-1.5 border-t px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h3 id={headingId} className="font-serif text-sm">
          {en.sidebar.worksHeading}
        </h3>
        <Button variant="ghost" size="sm" onClick={onAddWork}>
          <Plus aria-hidden />
          {en.works.addWork}
        </Button>
      </div>
      <WorksAreaContent />
    </section>
  );
}

function WorksAreaContent() {
  const { knowledgeLoad, retryKnowledgeLoad } = useKnowledge();

  if (knowledgeLoad === null || knowledgeLoad.phase === "loading") {
    return (
      <p role="status" className="text-ink-muted text-sm">
        {en.works.loading}
      </p>
    );
  }

  if (knowledgeLoad.phase === "failed") {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <p role="status" className="text-ink text-sm">
          {en.works.loadFailed}
        </p>
        <Button variant="secondary" size="sm" onClick={retryKnowledgeLoad}>
          {en.knowledge.tryAgain}
        </Button>
      </div>
    );
  }

  const { works } = knowledgeLoad.knowledge;
  if (works.length === 0) return <p className="text-ink-muted text-sm">{en.sidebar.noWorks}</p>;

  return (
    <ul aria-label={en.works.listLabel} className="flex min-w-0 flex-col gap-1.5">
      {works.map((work) => (
        <li key={work.id} className="flex min-w-0 flex-col">
          <UniverseNameText text={work.title} className="min-w-0 text-sm font-medium" />
          <span className="text-ink-muted text-xs">
            {MEDIUM_LABELS[work.medium] ?? work.medium} · {describeUnitCount(work)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The number of units with the unit wording of the work: "1 chapter", "120 chapters" (FR-2). */
function describeUnitCount(work: WorkDto): string {
  const wordingText = UNIT_WORDING_TEXTS[work.unitWording] ?? en.knowledge.unitWordings.unit;
  return `${work.unitCount} ${work.unitCount === 1 ? wordingText.singular : wordingText.plural}`;
}
