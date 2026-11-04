"use client";

import { useMemo, type MouseEvent } from "react";
import { en } from "@messages/en";
import { cn } from "@/components/ui/cn";
import { EntityTypeIcon } from "@/components/entities/entity-type-icon";
import { ENTITY_TYPE_ORDER } from "@/components/entities/entity-type-config";
import { useWorkspaceLayout } from "@/components/workspace/workspace-layout";
import { useWorkspaceState } from "@/components/workspace/workspace-state";
import { getEntitiesOfUniverse } from "@/data/queries";

// The accessible alternative to the graph: every entity is a link, grouped by type, in reading order.
export function EntityListView() {
  const { state, dispatch } = useWorkspaceState();
  const { openInspector } = useWorkspaceLayout();

  const entities = useMemo(
    () => getEntitiesOfUniverse(state.selectedUniverseId, state.selectedWorkId),
    [state.selectedUniverseId, state.selectedWorkId],
  );
  const groups = ENTITY_TYPE_ORDER.map((type) => ({
    type,
    entities: entities.filter((entity) => entity.type === type),
  })).filter((group) => group.entities.length > 0);

  function openEntity(event: MouseEvent<HTMLAnchorElement>, entityId: string) {
    event.preventDefault();
    dispatch({ type: "entitySelected", entityId });
    openInspector();
  }

  if (groups.length === 0) {
    return <p className="text-ink-muted p-4">{en.entityList.empty}</p>;
  }

  return (
    <div className="@container h-full overflow-y-auto p-4">
      <div className="gap-x-8 @2xl:columns-2">
        {groups.map((group) => (
          <section key={group.type} className="mb-5 break-inside-avoid">
            <h2 className="border-line mb-1 flex items-center gap-2 border-b pb-1 font-serif text-lg">
              <EntityTypeIcon type={group.type} />
              {en.entityTypePlural[group.type]}
              <span className="text-ink-muted ml-auto font-sans text-xs font-normal">{group.entities.length}</span>
            </h2>
            <ul>
              {group.entities.map((entity) => {
                const isSelected = state.selectedEntityId === entity.id;
                return (
                  <li key={entity.id}>
                    <a
                      href={`#${entity.id}`}
                      aria-current={isSelected ? "true" : undefined}
                      onClick={(event) => openEntity(event, entity.id)}
                      className={cn(
                        "rounded-control relative flex h-7 items-center justify-between gap-3 pr-2 pl-3 text-sm",
                        "transition-colors duration-(--motion-fast) ease-standard hover:bg-hover",
                        "aria-[current=true]:bg-selection aria-[current=true]:font-medium",
                        "before:rounded-pill before:absolute before:inset-y-1 before:left-0 before:w-0.5 aria-[current=true]:before:bg-accent",
                        "focus-visible:-outline-offset-2",
                      )}
                    >
                      <span className="truncate">{entity.name}</span>
                      <span className="text-ink-muted shrink-0 text-xs">{entity.introducedAt.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
