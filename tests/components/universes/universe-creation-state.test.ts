import { describe, expect, it } from "vitest";
import {
  CREATION_BLOCK_CAP_MILLISECONDS,
  CREATION_NOTICE_CODES,
  INITIAL_UNIVERSE_CREATION_STATE,
  isCreationBlocked,
  reduceUniverseCreationState,
  type UniverseCreationEvent,
  type UniverseCreationState,
} from "@/components/universes/universe-creation-state";

function applyEvents(...events: UniverseCreationEvent[]): UniverseCreationState {
  return events.reduce(reduceUniverseCreationState, INITIAL_UNIVERSE_CREATION_STATE);
}

describe("universe creation state: one request at a time", () => {
  it("starts with an open form and no message", () => {
    expect(isCreationBlocked(INITIAL_UNIVERSE_CREATION_STATE)).toBe(false);
    expect(INITIAL_UNIVERSE_CREATION_STATE.noticeCode).toBeNull();
  });

  it("a submission blocks the form", () => {
    expect(isCreationBlocked(applyEvents({ type: "submissionStarted", requestId: 1 }))).toBe(true);
  });

  it("a second submission while one is waiting changes nothing", () => {
    const waiting = applyEvents({ type: "submissionStarted", requestId: 1 });

    expect(reduceUniverseCreationState(waiting, { type: "submissionStarted", requestId: 2 })).toBe(waiting);
  });

  it("a new submission clears the message of the earlier one", () => {
    const afterFailure = applyEvents(
      { type: "submissionStarted", requestId: 1 },
      { type: "requestFailed", requestId: 1, noticeCode: CREATION_NOTICE_CODES.failed },
    );

    const afterResubmission = reduceUniverseCreationState(afterFailure, { type: "submissionStarted", requestId: 2 });

    expect(afterResubmission).toEqual({ blockingRequestId: 2, noticeCode: null });
  });
});

describe("universe creation state: the request ends", () => {
  it("a success releases the form with no message", () => {
    const state = applyEvents(
      { type: "submissionStarted", requestId: 1 },
      { type: "requestSucceeded", requestId: 1 },
    );

    expect(state).toEqual({ blockingRequestId: null, noticeCode: null });
  });

  it("a failure releases the form and shows its message", () => {
    const state = applyEvents(
      { type: "submissionStarted", requestId: 1 },
      { type: "requestFailed", requestId: 1, noticeCode: CREATION_NOTICE_CODES.failed },
    );

    expect(state).toEqual({ blockingRequestId: null, noticeCode: CREATION_NOTICE_CODES.failed });
  });

  it("field errors release the form and show no message", () => {
    const state = applyEvents(
      { type: "submissionStarted", requestId: 1 },
      { type: "requestFailed", requestId: 1, noticeCode: null },
    );

    expect(state).toEqual({ blockingRequestId: null, noticeCode: null });
  });

  it("a rejection after the 30 seconds ends the request and keeps the unknown-result message it was given", () => {
    const state = applyEvents(
      { type: "submissionStarted", requestId: 1 },
      { type: "answerIsLate", requestId: 1 },
      { type: "requestFailed", requestId: 1, noticeCode: CREATION_NOTICE_CODES.resultUnknown },
    );

    expect(state).toEqual({ blockingRequestId: null, noticeCode: CREATION_NOTICE_CODES.resultUnknown });
  });
});

describe("universe creation state: no answer in 30 seconds (FR-8)", () => {
  it("shows the unknown-result message and keeps the form blocked while the request is alive", () => {
    const state = applyEvents(
      { type: "submissionStarted", requestId: 1 },
      { type: "answerIsLate", requestId: 1 },
    );

    expect(state).toEqual({ blockingRequestId: 1, noticeCode: CREATION_NOTICE_CODES.resultUnknown });
    expect(isCreationBlocked(state)).toBe(true);
  });

  it("a late success replaces the message with the confirmation and releases the form", () => {
    const state = applyEvents(
      { type: "submissionStarted", requestId: 1 },
      { type: "answerIsLate", requestId: 1 },
      { type: "requestSucceeded", requestId: 1 },
    );

    expect(state).toEqual({ blockingRequestId: null, noticeCode: CREATION_NOTICE_CODES.confirmedAfterDelay });
  });

  it("the late notice of a request that is not the blocking one is ignored", () => {
    const state = applyEvents({ type: "submissionStarted", requestId: 2 });

    expect(reduceUniverseCreationState(state, { type: "answerIsLate", requestId: 1 })).toBe(state);
  });
});

describe("universe creation state: the 5-minute cap (D17)", () => {
  it("the cap is five minutes", () => {
    expect(CREATION_BLOCK_CAP_MILLISECONDS).toBe(5 * 60 * 1000);
  });

  it("releases the form and keeps the unknown-result message", () => {
    const state = applyEvents(
      { type: "submissionStarted", requestId: 1 },
      { type: "answerIsLate", requestId: 1 },
      { type: "blockCapReached", requestId: 1 },
    );

    expect(state).toEqual({ blockingRequestId: null, noticeCode: CREATION_NOTICE_CODES.resultUnknown });
    expect(isCreationBlocked(state)).toBe(false);
  });

  it("does nothing when the request already ended", () => {
    const ended = applyEvents(
      { type: "submissionStarted", requestId: 1 },
      { type: "requestFailed", requestId: 1, noticeCode: CREATION_NOTICE_CODES.failed },
    );

    expect(reduceUniverseCreationState(ended, { type: "blockCapReached", requestId: 1 })).toBe(ended);
  });

  it("does not release a later request that is the one blocking now", () => {
    const state = applyEvents(
      { type: "submissionStarted", requestId: 1 },
      { type: "blockCapReached", requestId: 1 },
      { type: "submissionStarted", requestId: 2 },
    );

    expect(reduceUniverseCreationState(state, { type: "blockCapReached", requestId: 1 })).toBe(state);
  });

  it("accepts a second submission after the cap", () => {
    const state = applyEvents(
      { type: "submissionStarted", requestId: 1 },
      { type: "blockCapReached", requestId: 1 },
      { type: "submissionStarted", requestId: 2 },
    );

    expect(state).toEqual({ blockingRequestId: 2, noticeCode: null });
  });

  it("an answer after the cap is applied as a normal success with the confirmation", () => {
    const state = applyEvents(
      { type: "submissionStarted", requestId: 1 },
      { type: "answerIsLate", requestId: 1 },
      { type: "blockCapReached", requestId: 1 },
      { type: "requestSucceeded", requestId: 1 },
    );

    expect(state).toEqual({ blockingRequestId: null, noticeCode: CREATION_NOTICE_CODES.confirmedAfterDelay });
  });

  it("the late success of the first request leaves the second one blocking the form", () => {
    const state = applyEvents(
      { type: "submissionStarted", requestId: 1 },
      { type: "blockCapReached", requestId: 1 },
      { type: "submissionStarted", requestId: 2 },
      { type: "requestSucceeded", requestId: 1 },
    );

    expect(state).toEqual({ blockingRequestId: 2, noticeCode: CREATION_NOTICE_CODES.confirmedAfterDelay });
  });

  it("a failure after the cap leaves the state as it is", () => {
    const released = applyEvents(
      { type: "submissionStarted", requestId: 1 },
      { type: "blockCapReached", requestId: 1 },
    );

    expect(
      reduceUniverseCreationState(released, {
        type: "requestFailed",
        requestId: 1,
        noticeCode: CREATION_NOTICE_CODES.failed,
      }),
    ).toBe(released);
  });
});

describe("universe creation state: dismissing the message", () => {
  it("clears a message left by an earlier form", () => {
    const state = applyEvents(
      { type: "submissionStarted", requestId: 1 },
      { type: "requestFailed", requestId: 1, noticeCode: CREATION_NOTICE_CODES.failed },
      { type: "noticeDismissed" },
    );

    expect(state.noticeCode).toBeNull();
  });

  it("keeps the message while a request still blocks the form", () => {
    const state = applyEvents(
      { type: "submissionStarted", requestId: 1 },
      { type: "answerIsLate", requestId: 1 },
    );

    expect(reduceUniverseCreationState(state, { type: "noticeDismissed" })).toBe(state);
  });
});
