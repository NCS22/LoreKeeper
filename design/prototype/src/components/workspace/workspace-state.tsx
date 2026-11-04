"use client";

import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import { getUniverses } from "@/data/queries";

export type CentralView = "graph" | "list";

export type WorkspaceState = {
  selectedUniverseId: string;
  // Null means the whole universe, with the content of all its works.
  selectedWorkId: string | null;
  selectedEntityId: string | null;
  // Universes opened in the sidebar tree. Kept here so the choice survives the sidebar drawer closing.
  expandedUniverseIds: readonly string[];
  view: CentralView;
  // While true the central area shows the creation form instead of the current view.
  isCreatingEntity: boolean;
};

type WorkspaceAction =
  | { type: "universeSelected"; universeId: string }
  | { type: "workSelected"; universeId: string; workId: string }
  | { type: "entitySelected"; entityId: string | null }
  | { type: "universeExpansionSet"; universeId: string; isExpanded: boolean }
  | { type: "viewChanged"; view: CentralView }
  | { type: "creationStarted" }
  | { type: "creationCancelled" };

function reduceWorkspaceState(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "universeSelected":
      return {
        ...state,
        selectedUniverseId: action.universeId,
        selectedWorkId: null,
        // An entity belongs to one universe, so it cannot stay selected in another.
        selectedEntityId: action.universeId === state.selectedUniverseId ? state.selectedEntityId : null,
        isCreatingEntity: false,
      };
    case "workSelected":
      return {
        ...state,
        selectedUniverseId: action.universeId,
        selectedWorkId: action.workId,
        selectedEntityId: action.universeId === state.selectedUniverseId ? state.selectedEntityId : null,
        isCreatingEntity: false,
      };
    case "entitySelected":
      return { ...state, selectedEntityId: action.entityId };
    case "universeExpansionSet": {
      const otherIds = state.expandedUniverseIds.filter((universeId) => universeId !== action.universeId);
      return { ...state, expandedUniverseIds: action.isExpanded ? [...otherIds, action.universeId] : otherIds };
    }
    case "viewChanged":
      return { ...state, view: action.view, isCreatingEntity: false };
    case "creationStarted":
      return { ...state, isCreatingEntity: true };
    case "creationCancelled":
      return { ...state, isCreatingEntity: false };
  }
}

type WorkspaceStateContextValue = {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
};

const WorkspaceStateContext = createContext<WorkspaceStateContextValue | null>(null);

export function WorkspaceStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduceWorkspaceState, {
    selectedUniverseId: getUniverses()[0].id,
    selectedWorkId: null,
    selectedEntityId: null,
    expandedUniverseIds: [getUniverses()[0].id],
    view: "graph",
    isCreatingEntity: false,
  });
  const contextValue = useMemo(() => ({ state, dispatch }), [state]);

  return <WorkspaceStateContext.Provider value={contextValue}>{children}</WorkspaceStateContext.Provider>;
}

export function useWorkspaceState(): WorkspaceStateContextValue {
  const contextValue = useContext(WorkspaceStateContext);
  if (contextValue === null) {
    throw new Error("useWorkspaceState must be used inside WorkspaceStateProvider");
  }
  return contextValue;
}
