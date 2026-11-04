"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { en } from "@/messages/en";
import { GraphLegend } from "@/components/graph/graph-legend";
import { Button } from "@/components/ui/button";
import { useWorkspaceLayout } from "@/components/workspace/workspace-layout";
import { useWorkspaceState } from "@/components/workspace/workspace-state";
import { getEntitiesOfUniverse, getRelationshipsBetween } from "@/mocks/data/queries";

// Cytoscape needs the browser, so the canvas is never rendered on the server.
const GraphCanvas = dynamic(() => import("@/components/graph/graph-canvas").then((module) => module.GraphCanvas), {
  ssr: false,
  loading: () => <p className="text-ink-muted p-4">{en.graph.loading}</p>,
});

export function GraphView() {
  const { state, dispatch } = useWorkspaceState();
  const { openInspector } = useWorkspaceLayout();

  const entities = useMemo(
    () => getEntitiesOfUniverse(state.selectedUniverseId, state.selectedWorkId),
    [state.selectedUniverseId, state.selectedWorkId],
  );
  const relationships = useMemo(
    () => getRelationshipsBetween(state.selectedUniverseId, new Set(entities.map((entity) => entity.id))),
    [state.selectedUniverseId, entities],
  );

  function selectEntity(entityId: string) {
    dispatch({ type: "entitySelected", entityId });
    openInspector();
  }

  if (entities.length === 0) {
    return <p className="text-ink-muted p-4">{en.entityList.empty}</p>;
  }

  return (
    <div className="relative h-full">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => dispatch({ type: "viewChanged", view: "list" })}
        className="sr-only z-10 focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
      >
        {en.graph.switchToList}
      </Button>
      <GraphCanvas
        entities={entities}
        relationships={relationships}
        selectedEntityId={state.selectedEntityId}
        onSelectEntity={selectEntity}
      />
      <GraphLegend />
    </div>
  );
}
