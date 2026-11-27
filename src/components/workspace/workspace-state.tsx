"use client";

import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";

export type CentralView = "graph" | "list";

/** The knowledge creation forms; at most one is open, in the central area (spec 006). */
export type KnowledgeForm = "work" | "entity" | "relationship";

export type WorkspaceState = {
  // Null while the account has no universe, or none was selected yet.
  selectedUniverseId: string | null;
  view: CentralView;
  // While true the central area shows the universe creation form instead of the current view.
  isCreatingUniverse: boolean;
  // While true the central area shows the edit form of the selected universe (spec 007a). Every change of the
  // selection closes it, so the edited universe is always the selected one and needs no identifier of its own.
  isEditingUniverse: boolean;
  // The open knowledge form, or null. It closes with its typed values when the universe changes (FR-12).
  knowledgeForm: KnowledgeForm | null;
  // The entity shown in the details panel. Nothing is selected after a reload or a change of universe (FR-9).
  selectedEntityId: string | null;
};

export type WorkspaceAction =
  | { type: "universeSelected"; universeId: string }
  | { type: "viewChanged"; view: CentralView }
  | { type: "universeCreationStarted" }
  | { type: "universeCreationCancelled" }
  | { type: "universeCreated"; universeId: string }
  | { type: "universeEditingStarted" }
  | { type: "universeEditingClosed" }
  | { type: "knowledgeFormOpened"; form: KnowledgeForm }
  | { type: "knowledgeFormClosed" }
  | { type: "entitySelected"; entityId: string };

export function reduceWorkspaceState(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "universeSelected":
    case "universeCreated":
      return {
        ...state,
        selectedUniverseId: action.universeId,
        isCreatingUniverse: false,
        isEditingUniverse: false,
        knowledgeForm: null,
        selectedEntityId: null,
      };
    case "viewChanged":
      return { ...state, view: action.view };
    case "universeCreationStarted":
      return { ...state, isCreatingUniverse: true, isEditingUniverse: false, knowledgeForm: null, selectedEntityId: null };
    case "universeCreationCancelled":
      return { ...state, isCreatingUniverse: false };
    case "universeEditingStarted":
      return startUniverseEditing(state);
    case "universeEditingClosed":
      return { ...state, isEditingUniverse: false };
    case "knowledgeFormOpened":
      return { ...state, isCreatingUniverse: false, isEditingUniverse: false, knowledgeForm: action.form };
    case "knowledgeFormClosed":
      return { ...state, knowledgeForm: null };
    case "entitySelected":
      return { ...state, selectedEntityId: action.entityId };
  }
}

// Ignored with no universe selected. An open edit form answers the same state, so it is not remounted and keeps the
// typed values (FR-2); otherwise it closes the creation form and the knowledge form, discarding their values (FR-3).
function startUniverseEditing(state: WorkspaceState): WorkspaceState {
  if (state.selectedUniverseId === null || state.isEditingUniverse) {
    return state;
  }
  return { ...state, isEditingUniverse: true, isCreatingUniverse: false, knowledgeForm: null };
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
    isEditingUniverse: false,
    knowledgeForm: null,
    selectedEntityId: null,
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
