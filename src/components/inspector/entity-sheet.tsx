"use client";

import { useEffect, useId, useMemo, useRef, type MouseEvent, type ReactNode } from "react";
import { en } from "@/messages/en";
import { EntityTypeBadge } from "@/components/entities/entity-type-badge";
import { EntityTypeIcon } from "@/components/entities/entity-type-icon";
import { StatusBadge } from "@/components/entities/status-badge";
import { KnowledgeRibbon } from "@/components/inspector/knowledge-ribbon";
import { useWorkspaceState } from "@/components/workspace/workspace-state";
import type { EntityDetailDto, RelatedEntityDto } from "@/mocks/dto/entity";

export function EntitySheet({ entity }: { entity: EntityDetailDto }) {
  const { dispatch } = useWorkspaceState();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const navigatedFromSheetRef = useRef(false);

  // A new entity starts at the top. If the user followed a link inside the sheet, focus moves to
  // the new name so keyboard and screen reader users are not left on a link that is gone.
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 });
    if (navigatedFromSheetRef.current) {
      navigatedFromSheetRef.current = false;
      headingRef.current?.focus();
    }
  }, [entity.id]);

  const sources = useMemo(() => {
    const locatorsBySource = new Map<string, { title: string; locators: string[] }>();
    for (const fragment of entity.knowledge) {
      for (const citation of fragment.citations) {
        const source = locatorsBySource.get(citation.sourceId) ?? { title: citation.sourceTitle, locators: [] };
        if (citation.locator !== null && !source.locators.includes(citation.locator)) source.locators.push(citation.locator);
        locatorsBySource.set(citation.sourceId, source);
      }
    }
    return [...locatorsBySource.entries()].map(([sourceId, source]) => ({ sourceId, ...source }));
  }, [entity.knowledge]);

  function openRelatedEntity(event: MouseEvent<HTMLAnchorElement>, relatedEntityId: string) {
    event.preventDefault();
    navigatedFromSheetRef.current = true;
    dispatch({ type: "entitySelected", entityId: relatedEntityId });
  }

  return (
    <div ref={scrollContainerRef} className="h-full overflow-y-auto px-4 pt-4 pb-8">
      <header className="flex flex-col items-start gap-2">
        <EntityTypeBadge type={entity.type} />
        <h3 ref={headingRef} tabIndex={-1} className="font-serif text-2xl leading-tight">
          {entity.name}
        </h3>
        <p className="text-ink-muted text-xs">
          {en.inspector.introducedAt} {entity.introducedAt.label}
        </p>
        {entity.aliases.length > 0 && (
          <p className="text-ink-muted text-sm">
            {en.inspector.aliasesLead}{" "}
            {entity.aliases.map((alias, index) => (
              <span key={alias.id}>
                {index > 0 && ", "}
                <span className="text-ink font-serif text-base italic">{alias.alias}</span>
                <span className="text-xs"> ({alias.revealedAt.label})</span>
              </span>
            ))}
          </p>
        )}
      </header>

      <SheetSection title={en.inspector.knowledgeTitle}>
        <KnowledgeRibbon entries={entity.knowledge} />
      </SheetSection>

      {entity.relationships.length > 0 && (
        <SheetSection title={en.inspector.relationshipsTitle}>
          <ul className="flex flex-col gap-1.5">
            {entity.relationships.map((relationship) => (
              <li key={relationship.id} className="flex items-baseline justify-between gap-3">
                <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                  <span className="text-ink-muted">{relationship.label}</span>
                  <RelatedEntityLink entity={relationship.relatedEntity} onOpen={openRelatedEntity} />
                  {relationship.status !== "CONFIRMED" && <StatusBadge status={relationship.status} />}
                </span>
                <span className="text-ink-muted shrink-0 text-xs">
                  <span className="sr-only">{en.inspector.revealedAt} </span>
                  {relationship.revealedAt.label}
                </span>
              </li>
            ))}
          </ul>
        </SheetSection>
      )}

      {entity.events.length > 0 && (
        <SheetSection title={en.inspector.eventsTitle}>
          <ul className="flex flex-col gap-2">
            {entity.events.map((event) => (
              <li key={event.id} className="flex items-baseline justify-between gap-3">
                <span className="flex flex-col">
                  <span className="font-medium">{event.title}</span>
                  <span className="text-ink-muted text-xs">
                    {en.inspector.eventRoles[event.role]}
                    {event.chronologicalLabel !== null && `, ${event.chronologicalLabel}`}
                  </span>
                </span>
                <span className="text-ink-muted shrink-0 text-xs">
                  <span className="sr-only">{en.inspector.revealedAt} </span>
                  {event.discoveredAt.label}
                </span>
              </li>
            ))}
          </ul>
        </SheetSection>
      )}

      {sources.length > 0 && (
        <SheetSection title={en.inspector.sourcesTitle}>
          <ul className="flex flex-col gap-1">
            {sources.map((source) => (
              <li key={source.sourceId} className="text-ink-muted text-sm">
                {source.title}
                {source.locators.length > 0 && `, ${source.locators.join(", ")}`}
              </li>
            ))}
          </ul>
        </SheetSection>
      )}
    </div>
  );
}

function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mt-6">
      <h4 id={headingId} className="border-line mb-3 border-b pb-1 font-serif text-lg">
        {title}
      </h4>
      {children}
    </section>
  );
}

type RelatedEntityLinkProps = {
  entity: RelatedEntityDto;
  onOpen: (event: MouseEvent<HTMLAnchorElement>, entityId: string) => void;
};

function RelatedEntityLink({ entity, onOpen }: RelatedEntityLinkProps) {
  return (
    <a
      href={`#${entity.id}`}
      onClick={(event) => onOpen(event, entity.id)}
      className="rounded-control hover:bg-hover -mx-1 inline-flex items-center gap-1.5 px-1 font-medium underline decoration-from-font underline-offset-2"
    >
      <EntityTypeIcon type={entity.type} />
      {entity.name}
    </a>
  );
}
