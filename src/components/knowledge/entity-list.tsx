"use client";

import { useId, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { en } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { useKnowledge } from "@/components/knowledge/knowledge-provider";
import { UniverseNameText } from "@/components/universes/universe-name-text";
import { useWorkspaceState } from "@/components/workspace/workspace-state";
import type { EntitySummaryDto } from "@/modules/knowledge";

const ENTITY_TYPE_LABELS: Readonly<Record<string, string>> = en.knowledge.entityTypes;

const ROW_CLASS_NAME = cn(
  "rounded-control relative flex w-full min-w-0 items-baseline justify-between gap-3 px-2 py-1.5 text-left text-sm",
  "transition-colors duration-(--motion-fast) ease-standard hover:bg-hover aria-pressed:bg-selection",
  "before:rounded-pill before:absolute before:inset-y-1 before:left-0 before:w-0.5 aria-pressed:before:bg-accent",
  "focus-visible:-outline-offset-2",
);

type EntityListProps = {
  onAddWork: () => void;
};

// The entity list of the selected universe (spec 006, FR-9): its entities in creation order, each a
// button that selects it; an honest empty state while there are none, or, while the universe has no
// work, the message that a work is needed first with the way to the work form.
export function EntityList({ onAddWork }: EntityListProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="border-line rounded-control flex min-w-0 flex-col gap-2 border p-4">
      <h2 id={headingId} className="font-serif text-lg">
        {en.entityList.heading}
      </h2>
      <EntityListContent onAddWork={onAddWork} />
    </section>
  );
}

function EntityListContent({ onAddWork }: EntityListProps): ReactNode {
  const { knowledgeLoad, retryKnowledgeLoad } = useKnowledge();

  if (knowledgeLoad === null || knowledgeLoad.phase === "loading") {
    return (
      <p role="status" className="text-ink-muted text-sm">
        {en.entityList.loading}
      </p>
    );
  }

  if (knowledgeLoad.phase === "failed") {
    return (
      <div className="flex flex-col items-start gap-2">
        <p role="status" className="text-ink text-sm">
          {en.entityList.loadFailed}
        </p>
        <Button variant="secondary" size="sm" onClick={retryKnowledgeLoad}>
          {en.knowledge.tryAgain}
        </Button>
      </div>
    );
  }

  const { works, entities } = knowledgeLoad.knowledge;
  if (works.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-ink-muted text-sm">{en.entityList.workNeededFirst}</p>
        <Button variant="secondary" size="sm" onClick={onAddWork}>
          <Plus aria-hidden />
          {en.entityList.addWork}
        </Button>
      </div>
    );
  }

  if (entities.length === 0) return <p className="text-ink-muted text-sm">{en.entityList.noEntities}</p>;

  return <EntityRows entities={entities} />;
}

function EntityRows({ entities }: { entities: readonly EntitySummaryDto[] }) {
  const { state, dispatch } = useWorkspaceState();

  return (
    <ul className="flex min-w-0 flex-col gap-px">
      {entities.map((entity) => (
        <li key={entity.id} className="min-w-0">
          <button
            type="button"
            aria-pressed={state.selectedEntityId === entity.id}
            onClick={() => dispatch({ type: "entitySelected", entityId: entity.id })}
            className={ROW_CLASS_NAME}
          >
            <UniverseNameText text={entity.name} className="min-w-0 font-medium" />
            <span className="text-ink-muted shrink-0 text-xs">{ENTITY_TYPE_LABELS[entity.type] ?? entity.type}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
