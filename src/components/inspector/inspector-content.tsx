"use client";

import { useMemo } from "react";
import { EntitySheet } from "@/components/inspector/entity-sheet";
import { InspectorEmptyState } from "@/components/inspector/inspector-empty-state";
import { useWorkspaceState } from "@/components/workspace/workspace-state";
import { findEntityDetail } from "@/mocks/data/queries";

export function InspectorContent() {
  const { state } = useWorkspaceState();
  const entity = useMemo(
    () => (state.selectedEntityId === null ? undefined : findEntityDetail(state.selectedEntityId)),
    [state.selectedEntityId],
  );

  return (
    <>
      {/* Announces the new entity to screen readers; the sheet itself is not a live region. */}
      <p role="status" className="sr-only">
        {entity?.name}
      </p>
      {entity === undefined ? <InspectorEmptyState /> : <EntitySheet entity={entity} />}
    </>
  );
}
