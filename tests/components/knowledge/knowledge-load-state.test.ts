import { describe, expect, it } from "vitest";
import {
  INITIAL_KNOWLEDGE_LOAD_STATE,
  readKnowledgeLoadOf,
  reduceKnowledgeLoadState,
  type KnowledgeLoadState,
  type UniverseKnowledgeView,
} from "@/components/knowledge/knowledge-load-state";

const KNOWLEDGE_OF_UNIVERSE_A: UniverseKnowledgeView = {
  works: [
    {
      id: "work-a",
      title: "The first book",
      medium: "NOVEL",
      unitWording: "chapter",
      unitCount: 120,
      createdAt: "2026-11-26T10:00:00.000Z",
    },
  ],
  entities: [],
  relationshipTypes: [],
};

const KNOWLEDGE_OF_UNIVERSE_B: UniverseKnowledgeView = { works: [], entities: [], relationshipTypes: [] };

function requestLoad(state: KnowledgeLoadState, universeId: string, requestId: number): KnowledgeLoadState {
  return reduceKnowledgeLoadState(state, { type: "loadRequested", universeId, requestId });
}

function loadedState(universeId: string, requestId: number, knowledge: UniverseKnowledgeView): KnowledgeLoadState {
  const requestedState = requestLoad(INITIAL_KNOWLEDGE_LOAD_STATE, universeId, requestId);
  return reduceKnowledgeLoadState(requestedState, { type: "loadSucceeded", universeId, requestId, knowledge });
}

describe("reduceKnowledgeLoadState: loading a universe", () => {
  it("is loading while the knowledge of the requested universe has not arrived", () => {
    const state = requestLoad(INITIAL_KNOWLEDGE_LOAD_STATE, "universe-a", 1);

    expect(readKnowledgeLoadOf(state, "universe-a")).toEqual({ phase: "loading" });
  });

  it("shows the knowledge of the universe once its answer arrives", () => {
    const state = loadedState("universe-a", 1, KNOWLEDGE_OF_UNIVERSE_A);

    expect(readKnowledgeLoadOf(state, "universe-a")).toEqual({ phase: "loaded", knowledge: KNOWLEDGE_OF_UNIVERSE_A });
  });

  it("is failed when the load of the universe fails, with nothing of it shown", () => {
    const requestedState = requestLoad(INITIAL_KNOWLEDGE_LOAD_STATE, "universe-a", 1);

    const state = reduceKnowledgeLoadState(requestedState, { type: "loadFailed", universeId: "universe-a", requestId: 1 });

    expect(readKnowledgeLoadOf(state, "universe-a")).toEqual({ phase: "failed" });
  });

  it("loads again after a failure, as Try again does", () => {
    const failedState = reduceKnowledgeLoadState(requestLoad(INITIAL_KNOWLEDGE_LOAD_STATE, "universe-a", 1), {
      type: "loadFailed",
      universeId: "universe-a",
      requestId: 1,
    });

    const state = requestLoad(failedState, "universe-a", 2);

    expect(readKnowledgeLoadOf(state, "universe-a")).toEqual({ phase: "loading" });
  });

  it("keeps showing the loaded knowledge while the same universe loads again, and then shows the new answer", () => {
    const refreshingState = requestLoad(loadedState("universe-a", 1, KNOWLEDGE_OF_UNIVERSE_A), "universe-a", 2);
    const refreshedKnowledge: UniverseKnowledgeView = { ...KNOWLEDGE_OF_UNIVERSE_A, works: [] };

    const answeredState = reduceKnowledgeLoadState(refreshingState, {
      type: "loadSucceeded",
      universeId: "universe-a",
      requestId: 2,
      knowledge: refreshedKnowledge,
    });

    expect(readKnowledgeLoadOf(refreshingState, "universe-a")).toEqual({ phase: "loaded", knowledge: KNOWLEDGE_OF_UNIVERSE_A });
    expect(readKnowledgeLoadOf(answeredState, "universe-a")).toEqual({ phase: "loaded", knowledge: refreshedKnowledge });
  });
});

describe("reduceKnowledgeLoadState: answers that no longer belong to the screen (FR-12, D12)", () => {
  it("discards, without any message, the answer of a universe that is no longer the one requested", () => {
    const stateOfUniverseB = requestLoad(requestLoad(INITIAL_KNOWLEDGE_LOAD_STATE, "universe-a", 1), "universe-b", 2);

    const state = reduceKnowledgeLoadState(stateOfUniverseB, {
      type: "loadSucceeded",
      universeId: "universe-a",
      requestId: 1,
      knowledge: KNOWLEDGE_OF_UNIVERSE_A,
    });

    expect(state).toEqual(stateOfUniverseB);
    expect(readKnowledgeLoadOf(state, "universe-b")).toEqual({ phase: "loading" });
  });

  it("discards the failure of a universe that is no longer the one requested", () => {
    const stateOfUniverseB = loadedState("universe-b", 2, KNOWLEDGE_OF_UNIVERSE_B);

    const state = reduceKnowledgeLoadState(stateOfUniverseB, { type: "loadFailed", universeId: "universe-a", requestId: 1 });

    expect(state).toEqual(stateOfUniverseB);
  });

  it("discards an earlier answer of the same universe that arrives after a later request", () => {
    const stateWithTwoRequests = requestLoad(requestLoad(INITIAL_KNOWLEDGE_LOAD_STATE, "universe-a", 1), "universe-a", 2);

    const state = reduceKnowledgeLoadState(stateWithTwoRequests, {
      type: "loadSucceeded",
      universeId: "universe-a",
      requestId: 1,
      knowledge: KNOWLEDGE_OF_UNIVERSE_A,
    });

    expect(state).toEqual(stateWithTwoRequests);
  });

  it("never shows the knowledge of one universe as the knowledge of another", () => {
    const stateOfUniverseA = loadedState("universe-a", 1, KNOWLEDGE_OF_UNIVERSE_A);

    expect(readKnowledgeLoadOf(stateOfUniverseA, "universe-b")).toEqual({ phase: "loading" });
  });

  it("drops what was shown of the earlier universe when another universe is requested", () => {
    const state = requestLoad(loadedState("universe-a", 1, KNOWLEDGE_OF_UNIVERSE_A), "universe-b", 2);

    expect(state.knowledge).toBeNull();
    expect(readKnowledgeLoadOf(state, "universe-a")).toEqual({ phase: "loading" });
  });

  it("shows the knowledge of a universe again when the person goes back and it is loaded again", () => {
    const stateOfUniverseB = requestLoad(loadedState("universe-a", 1, KNOWLEDGE_OF_UNIVERSE_A), "universe-b", 2);
    const backToUniverseA = requestLoad(stateOfUniverseB, "universe-a", 3);

    const state = reduceKnowledgeLoadState(backToUniverseA, {
      type: "loadSucceeded",
      universeId: "universe-a",
      requestId: 3,
      knowledge: KNOWLEDGE_OF_UNIVERSE_A,
    });

    expect(readKnowledgeLoadOf(state, "universe-a")).toEqual({ phase: "loaded", knowledge: KNOWLEDGE_OF_UNIVERSE_A });
  });
});
