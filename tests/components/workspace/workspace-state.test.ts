import { describe, expect, it } from "vitest";
import { reduceWorkspaceState, type WorkspaceState } from "@/components/workspace/workspace-state";

function buildWorkspaceState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    selectedUniverseId: "universe-a",
    selectedWorkId: "work-a1",
    selectedEntityId: "entity-a1",
    highlightedEntityId: "entity-a1",
    expandedUniverseIds: ["universe-a"],
    view: "graph",
    isCreatingEntity: false,
    isCreatingUniverse: false,
    ...overrides,
  };
}

describe("reduceWorkspaceState: universe creation", () => {
  it("starting the creation opens the form", () => {
    const nextState = reduceWorkspaceState(buildWorkspaceState(), { type: "universeCreationStarted" });

    expect(nextState.isCreatingUniverse).toBe(true);
  });

  it("starting the creation also closes entity creation", () => {
    const stateCreatingEntity = buildWorkspaceState({ isCreatingEntity: true });

    const nextState = reduceWorkspaceState(stateCreatingEntity, { type: "universeCreationStarted" });

    expect(nextState.isCreatingUniverse).toBe(true);
    expect(nextState.isCreatingEntity).toBe(false);
  });

  it("starting the creation keeps the current selection", () => {
    const initialState = buildWorkspaceState();

    const nextState = reduceWorkspaceState(initialState, { type: "universeCreationStarted" });

    expect(nextState.selectedUniverseId).toBe(initialState.selectedUniverseId);
    expect(nextState.selectedWorkId).toBe(initialState.selectedWorkId);
    expect(nextState.selectedEntityId).toBe(initialState.selectedEntityId);
  });

  it("cancelling closes the form and leaves the whole selection unchanged", () => {
    const stateCreatingUniverse = buildWorkspaceState({ isCreatingUniverse: true });

    const nextState = reduceWorkspaceState(stateCreatingUniverse, { type: "universeCreationCancelled" });

    expect(nextState).toEqual({ ...stateCreatingUniverse, isCreatingUniverse: false });
    expect(nextState.selectedUniverseId).toBe("universe-a");
  });

  it("a created universe is selected, with work and entity selection cleared and the form closed", () => {
    const stateCreatingUniverse = buildWorkspaceState({ isCreatingUniverse: true });

    const nextState = reduceWorkspaceState(stateCreatingUniverse, {
      type: "universeCreated",
      universeId: "universe-new",
    });

    expect(nextState.selectedUniverseId).toBe("universe-new");
    expect(nextState.selectedWorkId).toBeNull();
    expect(nextState.selectedEntityId).toBeNull();
    expect(nextState.highlightedEntityId).toBeNull();
    expect(nextState.isCreatingUniverse).toBe(false);
  });

  it("a created universe does not change the other universes' sidebar expansion or the view", () => {
    const stateCreatingUniverse = buildWorkspaceState({ isCreatingUniverse: true, view: "list" });

    const nextState = reduceWorkspaceState(stateCreatingUniverse, {
      type: "universeCreated",
      universeId: "universe-new",
    });

    expect(nextState.expandedUniverseIds).toEqual(["universe-a"]);
    expect(nextState.view).toBe("list");
  });

  it("selecting another universe while the form is open closes it", () => {
    const stateCreatingUniverse = buildWorkspaceState({ isCreatingUniverse: true });

    const nextState = reduceWorkspaceState(stateCreatingUniverse, {
      type: "universeSelected",
      universeId: "universe-b",
    });

    expect(nextState.isCreatingUniverse).toBe(false);
    expect(nextState.selectedUniverseId).toBe("universe-b");
  });

  it("selecting a work while the form is open closes it", () => {
    const stateCreatingUniverse = buildWorkspaceState({ isCreatingUniverse: true });

    const nextState = reduceWorkspaceState(stateCreatingUniverse, {
      type: "workSelected",
      universeId: "universe-b",
      workId: "work-b1",
    });

    expect(nextState.isCreatingUniverse).toBe(false);
    expect(nextState.selectedWorkId).toBe("work-b1");
  });
});

describe("reduceWorkspaceState: existing entity creation behavior", () => {
  it("starting and cancelling entity creation only toggles its flag", () => {
    const initialState = buildWorkspaceState();

    const startedState = reduceWorkspaceState(initialState, { type: "creationStarted" });
    const cancelledState = reduceWorkspaceState(startedState, { type: "creationCancelled" });

    expect(startedState).toEqual({ ...initialState, isCreatingEntity: true });
    expect(cancelledState).toEqual(initialState);
  });

  it("selecting a universe closes entity creation and clears the entity of another universe", () => {
    const stateCreatingEntity = buildWorkspaceState({ isCreatingEntity: true });

    const nextState = reduceWorkspaceState(stateCreatingEntity, {
      type: "universeSelected",
      universeId: "universe-b",
    });

    expect(nextState.isCreatingEntity).toBe(false);
    expect(nextState.selectedEntityId).toBeNull();
  });
});
