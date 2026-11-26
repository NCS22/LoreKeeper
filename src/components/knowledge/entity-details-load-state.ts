import type { EntityDetailsDto } from "@/modules/knowledge";

// The load of the details of the selected entity, as a pure reducer (specs/006-knowledge-items/plan.md,
// section 5, D12, D16). Every load carries the universe and the entity it was asked for and its request
// number: only the answer of the latest request for the entity the panel shows is applied, anything
// else is discarded without a message (FR-12).

export type EntityDetailsLoadState = {
  /** The universe and the entity of the latest request, or null before the first one. */
  readonly universeId: string | null;
  readonly entityId: string | null;
  readonly latestRequestId: number;
  readonly phase: "loading" | "loaded" | "failed";
  /** What is shown of that entity; null while nothing of it has arrived. */
  readonly details: EntityDetailsDto | null;
};

export const INITIAL_ENTITY_DETAILS_LOAD_STATE: EntityDetailsLoadState = {
  universeId: null,
  entityId: null,
  latestRequestId: 0,
  phase: "loading",
  details: null,
};

type DetailsRequest = { readonly universeId: string; readonly entityId: string; readonly requestId: number };

export type EntityDetailsLoadEvent =
  /** A load of the details was sent: on selection, after a relationship of the entity, or by Try again. */
  | ({ readonly type: "detailsRequested" } & DetailsRequest)
  | ({ readonly type: "detailsSucceeded"; readonly details: EntityDetailsDto } & DetailsRequest)
  /** The load failed or gave no usable answer. */
  | ({ readonly type: "detailsFailed" } & DetailsRequest);

/** What the panel shows for one selected entity. */
export type EntityDetailsLoad =
  | { readonly phase: "loading" }
  | { readonly phase: "failed" }
  | { readonly phase: "loaded"; readonly details: EntityDetailsDto };

export function reduceEntityDetailsLoadState(
  state: EntityDetailsLoadState,
  event: EntityDetailsLoadEvent,
): EntityDetailsLoadState {
  switch (event.type) {
    case "detailsRequested":
      // Loading the shown entity again keeps its details on screen until the new answer arrives.
      return isSameEntity(state, event) && state.phase === "loaded"
        ? { ...state, latestRequestId: event.requestId }
        : {
            universeId: event.universeId,
            entityId: event.entityId,
            latestRequestId: event.requestId,
            phase: "loading",
            details: null,
          };
    case "detailsSucceeded":
      return isLatestRequest(state, event) ? { ...state, phase: "loaded", details: event.details } : state;
    case "detailsFailed":
      return isLatestRequest(state, event) ? { ...state, phase: "failed", details: null } : state;
  }
}

/**
 * What the panel shows for the selected entity. While the latest load is of another entity or universe
 * (the selection changed and its load has not been sent yet), the selected one is loading: nothing of
 * another entity is ever shown for it.
 */
export function readEntityDetailsLoadOf(
  state: EntityDetailsLoadState,
  selectedUniverseId: string,
  selectedEntityId: string,
): EntityDetailsLoad {
  if (!isSameEntity(state, { universeId: selectedUniverseId, entityId: selectedEntityId })) return { phase: "loading" };
  if (state.phase === "loaded" && state.details !== null) return { phase: "loaded", details: state.details };
  return state.phase === "failed" ? { phase: "failed" } : { phase: "loading" };
}

function isSameEntity(state: EntityDetailsLoadState, selection: { universeId: string; entityId: string }): boolean {
  return selection.universeId === state.universeId && selection.entityId === state.entityId;
}

function isLatestRequest(state: EntityDetailsLoadState, answer: DetailsRequest): boolean {
  return isSameEntity(state, answer) && answer.requestId === state.latestRequestId;
}
