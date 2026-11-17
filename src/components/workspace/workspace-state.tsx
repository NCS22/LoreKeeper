"use client";

import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";

export type CentralView = "graph" | "list";

export type WorkspaceState = {
  // Null while the account has no universe, or none was selected yet.
  selectedUniverseId: string | null;
  view: CentralView;
  // While true the central area shows the universe creation form instead of the current view.
  isCreatingUniverse: boolean;
};

export type WorkspaceAction =
  | { type: "universeSelected"; universeId: string }
  | { type: "viewChanged"; view: CentralView }
  | { type: "universeCreationStarted" }
  | { type: "universeCreationCancelled" }
  | { type: "universeCreated"; universeId: string };

export function reduceWorkspaceState(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "universeSelected":
    case "universeCreated":
      return { ...state, selectedUniverseId: action.universeId, isCreatingUniverse: false };
    case "viewChanged":
      return { ...state, view: action.view };
    case "universeCreationStarted":
      return { ...state, isCreatingUniverse: true };
    case "universeCreationCancelled":
      return { ...state, isCreatingUniverse: false };
  }
}

type WorkspaceStateContextValue = {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
};

const WorkspaceStateContext = createContext<WorkspaceStateContextValue | null>(null);

type WorkspaceStateProviderProps = {
  children: ReactNode;
  // Chosen on the server: the remembered universe, else the oldest, else none (FR-26, FR-27).
  initialSelectedUniverseId: string | null;
};

export function WorkspaceStateProvider({ children, initialSelectedUniverseId }: WorkspaceStateProviderProps) {
  const [state, dispatch] = useReducer(reduceWorkspaceState, {
    selectedUniverseId: initialSelectedUniverseId,
    view: "graph",
    isCreatingUniverse: false,
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
