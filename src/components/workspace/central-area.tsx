"use client";

import { useRef, useState } from "react";
import { ChevronRight, List, Network, Plus } from "lucide-react";
import { en } from "@/messages/en";
import { EntityCreationForm } from "@/components/entities/entity-creation-form";
import { EntityListView } from "@/components/entities/entity-list-view";
import { GraphView } from "@/components/graph/graph-view";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UniverseCreationForm } from "@/components/universes/universe-creation-form";
import { UniverseEmptyState } from "@/components/universes/universe-empty-state";
import { useUniverses } from "@/components/universes/universes-provider";
import type { UniverseDto } from "@/modules/universes";
import { useWorkspaceState, type CentralView } from "@/components/workspace/workspace-state";
import { findWork, getEntitiesOfUniverse, getWorksOfUniverse } from "@/mocks/data/queries";

// "Is empty" uses the same sample-data queries as the views; it is replaced by the real read
// when the works and entities modules exist.
function isUniverseEmpty(universeId: string): boolean {
  return getWorksOfUniverse(universeId).length === 0 && getEntitiesOfUniverse(universeId, null).length === 0;
}

export function CentralArea() {
  const { state, dispatch } = useWorkspaceState();
  const { universes } = useUniverses();
  const newElementButtonRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The universe created a moment ago; only its empty state takes focus and announces itself.
  const [justCreatedUniverseId, setJustCreatedUniverseId] = useState<string | null>(null);
  if (justCreatedUniverseId !== null && justCreatedUniverseId !== state.selectedUniverseId) {
    // The user moved to another universe: coming back later is a plain selection, not a creation.
    setJustCreatedUniverseId(null);
  }
  const universe = universes.find((candidate) => candidate.id === state.selectedUniverseId);
  const work = state.selectedWorkId === null ? undefined : findWork(state.selectedWorkId);
  if (universe === undefined) return null;

  function changeView(value: string) {
    // The group reports an empty value when the pressed segment is pressed again; ignore it.
    if (value === "graph" || value === "list") dispatch({ type: "viewChanged", view: value satisfies CentralView });
  }

  function cancelCreation() {
    dispatch({ type: "creationCancelled" });
    // Back to where the user was: the button is enabled again once the view has re-rendered.
    requestAnimationFrame(() => newElementButtonRef.current?.focus());
  }

  function cancelUniverseCreation() {
    dispatch({ type: "universeCreationCancelled" });
    // The selection is unchanged, so focus goes to the heading of the universe the user was in.
    headingRef.current?.focus();
  }

  function finishUniverseCreation(createdUniverse: UniverseDto) {
    setJustCreatedUniverseId(createdUniverse.id);
    dispatch({ type: "universeCreated", universeId: createdUniverse.id });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-line flex min-h-10 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1">
        <ToggleGroup type="single" aria-label={en.center.viewSwitcherLabel} value={state.view} onValueChange={changeView}>
          <ToggleGroupItem value="graph">
            <Network aria-hidden />
            {en.center.graphView}
          </ToggleGroupItem>
          <ToggleGroupItem value="list">
            <List aria-hidden />
            {en.center.listView}
          </ToggleGroupItem>
        </ToggleGroup>

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="order-last flex w-full min-w-0 items-center gap-1.5 font-serif text-lg sm:order-none sm:w-auto sm:flex-1"
        >
          {work === undefined ? (
            <span className="truncate">{universe.name}</span>
          ) : (
            <>
              <span className="text-ink-muted truncate">{universe.name}</span>
              <ChevronRight aria-hidden className="text-ink-muted size-4 shrink-0" />
              <span className="sr-only">, </span>
              <span className="truncate">{work.title}</span>
            </>
          )}
        </h1>

        <Button
          ref={newElementButtonRef}
          className="ml-auto sm:ml-0"
          disabled={state.isCreatingEntity || state.isCreatingUniverse}
          onClick={() => dispatch({ type: "creationStarted" })}
        >
          <Plus aria-hidden />
          <span className="sr-only sm:not-sr-only">{en.center.newElement}</span>
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        {state.isCreatingUniverse ? (
          <UniverseCreationForm onCreated={finishUniverseCreation} onCancel={cancelUniverseCreation} />
        ) : state.isCreatingEntity ? (
          <EntityCreationForm onCancel={cancelCreation} />
        ) : isUniverseEmpty(universe.id) ? (
          <UniverseEmptyState
            key={universe.id}
            universeName={universe.name}
            wasJustCreated={universe.id === justCreatedUniverseId}
          />
        ) : state.view === "list" ? (
          <EntityListView />
        ) : (
          <GraphView />
        )}
      </div>
    </div>
  );
}
