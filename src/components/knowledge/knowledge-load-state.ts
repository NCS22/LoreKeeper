import type { EntitySummaryDto, RelationshipTypeDto, WorkDto } from "@/modules/knowledge";

// The load of what the workspace shows of the selected universe, as a pure reducer (specs/006-
// knowledge-items/plan.md, section 5, D9, D12). Every load carries the universe it was asked for and
// its request number: only the answer of the latest request for the universe the screen shows is
// applied, anything else is discarded without a message (FR-12).

/** The knowledge of one universe, as the load action answers it. */
export type UniverseKnowledgeView = {
  readonly works: readonly WorkDto[];
  readonly entities: readonly EntitySummaryDto[];
  readonly relationshipTypes: readonly RelationshipTypeDto[];
};

export type KnowledgeLoadState = {
  /** The universe of the latest request, or null before the first one. */
  readonly universeId: string | null;
  readonly latestRequestId: number;
  readonly phase: "loading" | "loaded" | "failed";
  /** What is shown of that universe; null while nothing of it has arrived. */
  readonly knowledge: UniverseKnowledgeView | null;
};

export const INITIAL_KNOWLEDGE_LOAD_STATE: KnowledgeLoadState = {
  universeId: null,
  latestRequestId: 0,
  phase: "loading",
  knowledge: null,
};

export type KnowledgeLoadEvent =
  /** A load of the universe was sent: on selection, after a creation, or by Try again. */
  | { readonly type: "loadRequested"; readonly universeId: string; readonly requestId: number }
  | {
      readonly type: "loadSucceeded";
      readonly universeId: string;
      readonly requestId: number;
      readonly knowledge: UniverseKnowledgeView;
    }
  /** The load failed or gave no usable answer. */
  | { readonly type: "loadFailed"; readonly universeId: string; readonly requestId: number };

/** What the screen shows for one universe. */
export type KnowledgeLoad =
  | { readonly phase: "loading" }
  | { readonly phase: "failed" }
  | { readonly phase: "loaded"; readonly knowledge: UniverseKnowledgeView };

export function reduceKnowledgeLoadState(state: KnowledgeLoadState, event: KnowledgeLoadEvent): KnowledgeLoadState {
  switch (event.type) {
    case "loadRequested":
      // Loading the shown universe again keeps its content on screen until the new answer arrives.
      return event.universeId === state.universeId && state.phase === "loaded"
        ? { ...state, latestRequestId: event.requestId }
        : { universeId: event.universeId, latestRequestId: event.requestId, phase: "loading", knowledge: null };
    case "loadSucceeded":
      return isLatestRequest(state, event)
        ? { ...state, phase: "loaded", knowledge: event.knowledge }
        : state;
    case "loadFailed":
      return isLatestRequest(state, event) ? { ...state, phase: "failed", knowledge: null } : state;
  }
}

/**
 * What the screen shows for the selected universe. While the latest load is of another universe (the
 * selection changed and its load has not been sent yet), the selected one is loading: nothing of
 * another universe is ever shown for it.
 */
export function readKnowledgeLoadOf(state: KnowledgeLoadState, selectedUniverseId: string): KnowledgeLoad {
  if (state.universeId !== selectedUniverseId) return { phase: "loading" };
  if (state.phase === "loaded" && state.knowledge !== null) return { phase: "loaded", knowledge: state.knowledge };
  return state.phase === "failed" ? { phase: "failed" } : { phase: "loading" };
}

function isLatestRequest(state: KnowledgeLoadState, answer: { universeId: string; requestId: number }): boolean {
  return answer.universeId === state.universeId && answer.requestId === state.latestRequestId;
}
