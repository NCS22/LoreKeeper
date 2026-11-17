import { describe, expect, it } from "vitest";
import { reduceWorkspaceState, type WorkspaceState } from "@/components/workspace/workspace-state";

function buildWorkspaceState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    selectedUniverseId: "universe-a",
    view: "graph",
    isCreatingUniverse: false,
    ...overrides,
  };
}

describe("reduceWorkspaceState: the shape of the state", () => {
  it("holds only the selected universe, the view and whether the creation form is open", () => {
    expect(Object.keys(buildWorkspaceState()).sort()).toEqual(["isCreatingUniverse", "selectedUniverseId", "view"]);
  });
});

describe("reduceWorkspaceState: selecting", () => {
  it("selecting a universe selects it and keeps the view", () => {
    const nextState = reduceWorkspaceState(buildWorkspaceState({ view: "list" }), {
      type: "universeSelected",
      universeId: "universe-b",
    });

    expect(nextState).toEqual({ selectedUniverseId: "universe-b", view: "list", isCreatingUniverse: false });
  });

  it("selecting a universe while the form is open closes it", () => {
    const nextState = reduceWorkspaceState(buildWorkspaceState({ isCreatingUniverse: true }), {
      type: "universeSelected",
      universeId: "universe-b",
    });

    expect(nextState.isCreatingUniverse).toBe(false);
    expect(nextState.selectedUniverseId).toBe("universe-b");
  });

  it("selecting a universe when none was selected selects it", () => {
    const nextState = reduceWorkspaceState(buildWorkspaceState({ selectedUniverseId: null }), {
      type: "universeSelected",
      universeId: "universe-a",
    });

    expect(nextState.selectedUniverseId).toBe("universe-a");
  });

  it("changing the view changes only the view", () => {
    const initialState = buildWorkspaceState({ isCreatingUniverse: true });

    const nextState = reduceWorkspaceState(initialState, { type: "viewChanged", view: "list" });

    expect(nextState).toEqual({ ...initialState, view: "list" });
  });
});

describe("reduceWorkspaceState: the creation form", () => {
  it("starting the creation opens the form and keeps the selection", () => {
    const initialState = buildWorkspaceState();

    const nextState = reduceWorkspaceState(initialState, { type: "universeCreationStarted" });

    expect(nextState).toEqual({ ...initialState, isCreatingUniverse: true });
  });

  it("cancelling closes the form and leaves everything else unchanged", () => {
    const stateCreatingUniverse = buildWorkspaceState({ isCreatingUniverse: true });

    const nextState = reduceWorkspaceState(stateCreatingUniverse, { type: "universeCreationCancelled" });

    expect(nextState).toEqual({ ...stateCreatingUniverse, isCreatingUniverse: false });
  });

  it("a created universe is selected and the form closes, keeping the view", () => {
    const stateCreatingUniverse = buildWorkspaceState({ isCreatingUniverse: true, view: "list" });

    const nextState = reduceWorkspaceState(stateCreatingUniverse, {
      type: "universeCreated",
      universeId: "universe-new",
    });

    expect(nextState).toEqual({ selectedUniverseId: "universe-new", view: "list", isCreatingUniverse: false });
  });

  it("with no universe selected, a created universe is selected and the form closes", () => {
    const stateWithoutUniverse = buildWorkspaceState({ selectedUniverseId: null, isCreatingUniverse: true });

    const nextState = reduceWorkspaceState(stateWithoutUniverse, {
      type: "universeCreated",
      universeId: "universe-new",
    });

    expect(nextState.selectedUniverseId).toBe("universe-new");
    expect(nextState.isCreatingUniverse).toBe(false);
  });

  it("with no universe selected, starting and cancelling the creation leaves the selection empty", () => {
    const stateWithoutUniverse = buildWorkspaceState({ selectedUniverseId: null });

    const startedState = reduceWorkspaceState(stateWithoutUniverse, { type: "universeCreationStarted" });
    const cancelledState = reduceWorkspaceState(startedState, { type: "universeCreationCancelled" });

    expect(startedState.isCreatingUniverse).toBe(true);
    expect(startedState.selectedUniverseId).toBeNull();
    expect(cancelledState).toEqual(stateWithoutUniverse);
  });
});
