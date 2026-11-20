"use client";

import { useRef, useState } from "react";
import { List, Network } from "lucide-react";
import { en } from "@/messages/en";
import { EntityListEmptyState } from "@/components/entities/entity-list-empty-state";
import { GraphEmptyState } from "@/components/graph/graph-empty-state";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LateCreationConfirmation } from "@/components/universes/late-creation-confirmation";
import { NoUniversesEmptyState } from "@/components/universes/no-universes-empty-state";
import { UniverseCreationForm } from "@/components/universes/universe-creation-form";
import { UniverseEmptyState } from "@/components/universes/universe-empty-state";
import { useUniverses } from "@/components/universes/universes-provider";
import type { UniverseDto } from "@/modules/universes";
import { useWorkspaceState, type CentralView } from "@/components/workspace/workspace-state";

export function CentralArea() {
  const { state, dispatch } = useWorkspaceState();
  const { universes } = useUniverses();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const createFirstUniverseButtonRef = useRef<HTMLButtonElement>(null);
  // The universe created a moment ago; only its empty state takes focus and announces itself.
  const [justCreatedUniverseId, setJustCreatedUniverseId] = useState<string | null>(null);
  if (justCreatedUniverseId !== null && justCreatedUniverseId !== state.selectedUniverseId) {
    // The user moved to another universe: coming back later is a plain selection, not a creation.
    setJustCreatedUniverseId(null);
  }
  const universe = universes.find((candidate) => candidate.id === state.selectedUniverseId);

  function changeView(value: string) {
    // The group reports an empty value when the pressed segment is pressed again; ignore it.
    if (value === "graph" || value === "list") dispatch({ type: "viewChanged", view: value satisfies CentralView });
  }

  function cancelUniverseCreation() {
    dispatch({ type: "universeCreationCancelled" });
    // The form is gone once the view has re-rendered: focus goes back to where the person was, the
    // heading of the selected universe or the button that invited to create the first one.
    requestAnimationFrame(() => (universe === undefined ? createFirstUniverseButtonRef : headingRef).current?.focus());
  }

  // The provider has already added, selected and remembered the universe: here only its focus and announcement.
  function finishUniverseCreation(createdUniverse: UniverseDto) {
    setJustCreatedUniverseId(createdUniverse.id);
  }

  // No universe is selected (the account has none yet): no views to switch, only the way to create one.
  if (universe === undefined) {
    return (
      <div className="h-full overflow-y-auto">
        {state.isCreatingUniverse ? (
          <UniverseCreationForm onCreated={finishUniverseCreation} onCancel={cancelUniverseCreation} />
        ) : (
          <div className="p-6">
            <NoUniversesEmptyState
              createButtonRef={createFirstUniverseButtonRef}
              onCreateFirstUniverse={() => dispatch({ type: "universeCreationStarted" })}
            />
          </div>
        )}
      </div>
    );
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
      </div>

      <LateCreationConfirmation />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {state.isCreatingUniverse ? (
          <UniverseCreationForm onCreated={finishUniverseCreation} onCancel={cancelUniverseCreation} />
        ) : (
          <div className="mx-auto flex min-w-0 max-w-3xl flex-col gap-6 p-6">
            <UniverseEmptyState
              key={universe.id}
              universe={universe}
              headingRef={headingRef}
              wasJustCreated={universe.id === justCreatedUniverseId}
            />
            {state.view === "list" ? <EntityListEmptyState /> : <GraphEmptyState />}
          </div>
        )}
      </div>
    </div>
  );
}
