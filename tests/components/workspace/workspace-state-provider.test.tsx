import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useWorkspaceState, WorkspaceStateProvider } from "@/components/workspace/workspace-state";

afterEach(cleanup);

// A child of the provider that shows the shared state as text and changes it through the hook,
// the way the workspace screens do.
function WorkspaceStateProbe() {
  const { state, dispatch } = useWorkspaceState();

  return (
    <div>
      <p>Selected universe: {state.selectedUniverseId ?? "none"}</p>
      <p>Central view: {state.view}</p>
      <p>Creation form: {state.isCreatingUniverse ? "open" : "closed"}</p>
      <button type="button" onClick={() => dispatch({ type: "universeSelected", universeId: "universe-b" })}>
        Select universe B
      </button>
      <button type="button" onClick={() => dispatch({ type: "viewChanged", view: "list" })}>
        Show the list
      </button>
      <button type="button" onClick={() => dispatch({ type: "universeCreationStarted" })}>
        Start creating
      </button>
      <button type="button" onClick={() => dispatch({ type: "universeCreationCancelled" })}>
        Cancel creating
      </button>
      <button type="button" onClick={() => dispatch({ type: "universeCreated", universeId: "universe-new" })}>
        Finish creating
      </button>
    </div>
  );
}

function renderProbeInsideProvider(initialSelectedUniverseId: string | null) {
  render(
    <WorkspaceStateProvider initialSelectedUniverseId={initialSelectedUniverseId}>
      <WorkspaceStateProbe />
    </WorkspaceStateProvider>,
  );
}

describe("WorkspaceStateProvider: the initial state", () => {
  it("starts with the universe chosen by the server, the graph view and no creation form", () => {
    renderProbeInsideProvider("universe-a");

    expect(screen.getByText("Selected universe: universe-a")).toBeDefined();
    expect(screen.getByText("Central view: graph")).toBeDefined();
    expect(screen.getByText("Creation form: closed")).toBeDefined();
  });

  it("starts with no universe selected when the server chose none", () => {
    renderProbeInsideProvider(null);

    expect(screen.getByText("Selected universe: none")).toBeDefined();
    expect(screen.getByText("Central view: graph")).toBeDefined();
    expect(screen.getByText("Creation form: closed")).toBeDefined();
  });
});

describe("WorkspaceStateProvider: actions through the hook", () => {
  it("selecting a universe changes the selection its children see", () => {
    renderProbeInsideProvider("universe-a");

    fireEvent.click(screen.getByRole("button", { name: "Select universe B" }));

    expect(screen.getByText("Selected universe: universe-b")).toBeDefined();
    expect(screen.getByText("Central view: graph")).toBeDefined();
  });

  it("changing the view shows the list and keeps the selection", () => {
    renderProbeInsideProvider("universe-a");

    fireEvent.click(screen.getByRole("button", { name: "Show the list" }));

    expect(screen.getByText("Central view: list")).toBeDefined();
    expect(screen.getByText("Selected universe: universe-a")).toBeDefined();
  });

  it("starting and cancelling the creation opens and closes the form and keeps the selection", () => {
    renderProbeInsideProvider("universe-a");

    fireEvent.click(screen.getByRole("button", { name: "Start creating" }));
    expect(screen.getByText("Creation form: open")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Cancel creating" }));
    expect(screen.getByText("Creation form: closed")).toBeDefined();
    expect(screen.getByText("Selected universe: universe-a")).toBeDefined();
  });

  it("finishing the creation selects the new universe and closes the form", () => {
    renderProbeInsideProvider(null);

    fireEvent.click(screen.getByRole("button", { name: "Start creating" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish creating" }));

    expect(screen.getByText("Selected universe: universe-new")).toBeDefined();
    expect(screen.getByText("Creation form: closed")).toBeDefined();
  });
});

describe("useWorkspaceState outside the provider", () => {
  it("fails loudly instead of giving an empty state", () => {
    expect(() => renderHook(() => useWorkspaceState())).toThrow(
      "useWorkspaceState must be used inside WorkspaceStateProvider",
    );
  });
});
