import { describe, expect, it } from "vitest";
import {
  INITIAL_ENTITY_DETAILS_LOAD_STATE,
  readEntityDetailsLoadOf,
  reduceEntityDetailsLoadState,
  type EntityDetailsLoadState,
} from "@/components/knowledge/entity-details-load-state";
import type { EntityDetailsDto } from "@/modules/knowledge";

const POINT = { workId: "work-a", workTitle: "The first book", unitWording: "chapter", unitLabel: "3" } as const;

const DETAILS_OF_FRODO: EntityDetailsDto = {
  id: "entity-frodo",
  name: "Frodo",
  type: "CHARACTER",
  introducedAt: POINT,
  firstFragment: null,
  relationships: [],
};

const DETAILS_OF_FRODO_WITH_A_RELATIONSHIP: EntityDetailsDto = {
  ...DETAILS_OF_FRODO,
  relationships: [
    { id: "relationship-1", status: "USER_NOTE", point: POINT, subjectName: "Frodo", label: "member of", otherName: "Fellowship" },
  ],
};

const DETAILS_OF_SAM: EntityDetailsDto = { ...DETAILS_OF_FRODO, id: "entity-sam", name: "Sam" };

type Selection = { readonly universeId: string; readonly entityId: string };

const FRODO_IN_A: Selection = { universeId: "universe-a", entityId: "entity-frodo" };
const SAM_IN_A: Selection = { universeId: "universe-a", entityId: "entity-sam" };
const FRODO_IN_B: Selection = { universeId: "universe-b", entityId: "entity-frodo" };

function requestDetails(state: EntityDetailsLoadState, selection: Selection, requestId: number): EntityDetailsLoadState {
  return reduceEntityDetailsLoadState(state, { type: "detailsRequested", ...selection, requestId });
}

function answerDetails(
  state: EntityDetailsLoadState,
  selection: Selection,
  requestId: number,
  details: EntityDetailsDto,
): EntityDetailsLoadState {
  return reduceEntityDetailsLoadState(state, { type: "detailsSucceeded", ...selection, requestId, details });
}

function readLoadOf(state: EntityDetailsLoadState, selection: Selection) {
  return readEntityDetailsLoadOf(state, selection.universeId, selection.entityId);
}

describe("reduceEntityDetailsLoadState: loading the details of the selected entity (FR-10)", () => {
  it("is loading while the details of the selected entity have not arrived", () => {
    const state = requestDetails(INITIAL_ENTITY_DETAILS_LOAD_STATE, FRODO_IN_A, 1);

    expect(readLoadOf(state, FRODO_IN_A)).toEqual({ phase: "loading" });
  });

  it("shows the details once their answer arrives", () => {
    const state = answerDetails(requestDetails(INITIAL_ENTITY_DETAILS_LOAD_STATE, FRODO_IN_A, 1), FRODO_IN_A, 1, DETAILS_OF_FRODO);

    expect(readLoadOf(state, FRODO_IN_A)).toEqual({ phase: "loaded", details: DETAILS_OF_FRODO });
  });

  it("is failed when the load fails, with nothing of the entity shown", () => {
    const requestedState = requestDetails(INITIAL_ENTITY_DETAILS_LOAD_STATE, FRODO_IN_A, 1);

    const state = reduceEntityDetailsLoadState(requestedState, { type: "detailsFailed", ...FRODO_IN_A, requestId: 1 });

    expect(readLoadOf(state, FRODO_IN_A)).toEqual({ phase: "failed" });
  });

  it("loads again after a failure, as Try again does", () => {
    const failedState = reduceEntityDetailsLoadState(requestDetails(INITIAL_ENTITY_DETAILS_LOAD_STATE, FRODO_IN_A, 1), {
      type: "detailsFailed",
      ...FRODO_IN_A,
      requestId: 1,
    });

    const state = answerDetails(requestDetails(failedState, FRODO_IN_A, 2), FRODO_IN_A, 2, DETAILS_OF_FRODO);

    expect(readLoadOf(state, FRODO_IN_A)).toEqual({ phase: "loaded", details: DETAILS_OF_FRODO });
  });

  it("keeps the shown details while they load again after a relationship is created, and then shows the new ones", () => {
    const loadedState = answerDetails(requestDetails(INITIAL_ENTITY_DETAILS_LOAD_STATE, FRODO_IN_A, 1), FRODO_IN_A, 1, DETAILS_OF_FRODO);

    const reloadingState = requestDetails(loadedState, FRODO_IN_A, 2);
    const reloadedState = answerDetails(reloadingState, FRODO_IN_A, 2, DETAILS_OF_FRODO_WITH_A_RELATIONSHIP);

    expect(readLoadOf(reloadingState, FRODO_IN_A)).toEqual({ phase: "loaded", details: DETAILS_OF_FRODO });
    expect(readLoadOf(reloadedState, FRODO_IN_A)).toEqual({ phase: "loaded", details: DETAILS_OF_FRODO_WITH_A_RELATIONSHIP });
  });
});

describe("reduceEntityDetailsLoadState: answers that no longer belong to the selection", () => {
  it("never shows the details of one entity as the details of another selected after it", () => {
    const loadedState = answerDetails(requestDetails(INITIAL_ENTITY_DETAILS_LOAD_STATE, FRODO_IN_A, 1), FRODO_IN_A, 1, DETAILS_OF_FRODO);

    const state = requestDetails(loadedState, SAM_IN_A, 2);

    expect(readLoadOf(state, SAM_IN_A)).toEqual({ phase: "loading" });
  });

  it("discards, without any message, the answer of an entity that is no longer the one requested", () => {
    const state = requestDetails(requestDetails(INITIAL_ENTITY_DETAILS_LOAD_STATE, FRODO_IN_A, 1), SAM_IN_A, 2);

    const stateAfterLateAnswer = answerDetails(state, FRODO_IN_A, 1, DETAILS_OF_FRODO);
    const stateAfterLateFailure = reduceEntityDetailsLoadState(state, { type: "detailsFailed", ...FRODO_IN_A, requestId: 1 });

    expect(stateAfterLateAnswer).toEqual(state);
    expect(stateAfterLateFailure).toEqual(state);
    expect(readLoadOf(answerDetails(stateAfterLateAnswer, SAM_IN_A, 2, DETAILS_OF_SAM), SAM_IN_A)).toEqual({
      phase: "loaded",
      details: DETAILS_OF_SAM,
    });
  });

  it("discards the answer for the same entity identifier asked in a universe that is no longer selected (FR-12)", () => {
    const state = requestDetails(requestDetails(INITIAL_ENTITY_DETAILS_LOAD_STATE, FRODO_IN_A, 1), FRODO_IN_B, 2);

    expect(answerDetails(state, FRODO_IN_A, 1, DETAILS_OF_FRODO)).toEqual(state);
  });

  it("discards an earlier answer of the same entity that arrives after a later request", () => {
    const state = requestDetails(requestDetails(INITIAL_ENTITY_DETAILS_LOAD_STATE, FRODO_IN_A, 1), FRODO_IN_A, 2);

    const stateAfterEarlierAnswer = answerDetails(state, FRODO_IN_A, 1, DETAILS_OF_FRODO);

    expect(readLoadOf(stateAfterEarlierAnswer, FRODO_IN_A)).toEqual({ phase: "loading" });
  });

  it("is loading for a selection whose load has not been sent yet, never showing the previous one", () => {
    const loadedState = answerDetails(requestDetails(INITIAL_ENTITY_DETAILS_LOAD_STATE, FRODO_IN_A, 1), FRODO_IN_A, 1, DETAILS_OF_FRODO);

    expect(readLoadOf(loadedState, SAM_IN_A)).toEqual({ phase: "loading" });
    expect(readLoadOf(loadedState, FRODO_IN_B)).toEqual({ phase: "loading" });
  });
});
