import { describe, expect, it } from "vitest";
import {
  EDIT_BLOCK_CAP_MILLISECONDS,
  EDIT_NOTICE_CODES,
  INITIAL_UNIVERSE_EDIT_STATE,
  editNoticeFor,
  isEditBlocked,
  reduceUniverseEditState,
  type UniverseEditEvent,
  type UniverseEditState,
} from "@/components/universes/universe-edit-state";
import { CREATION_NOTICE_CODES } from "@/components/universes/universe-creation-state";

const EDITED_UNIVERSE_ID = "7d3f1c2a-5b6e-4a8d-9c0f-1e2d3c4b5a69";
const OTHER_UNIVERSE_ID = "0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d";

function applyEvents(...events: UniverseEditEvent[]): UniverseEditState {
  return events.reduce(reduceUniverseEditState, INITIAL_UNIVERSE_EDIT_STATE);
}

function submission(requestId: number, universeId = EDITED_UNIVERSE_ID): UniverseEditEvent {
  return { type: "submissionStarted", universeId, requestId };
}

describe("universe edit state: one request at a time", () => {
  it("starts with an open form and no message for any universe", () => {
    expect(isEditBlocked(INITIAL_UNIVERSE_EDIT_STATE, EDITED_UNIVERSE_ID)).toBe(false);
    expect(editNoticeFor(INITIAL_UNIVERSE_EDIT_STATE, EDITED_UNIVERSE_ID)).toBeNull();
  });

  it("a submission blocks the form of that universe only", () => {
    const state = applyEvents(submission(1));

    expect(isEditBlocked(state, EDITED_UNIVERSE_ID)).toBe(true);
    expect(isEditBlocked(state, OTHER_UNIVERSE_ID)).toBe(false);
  });

  it("a second submission for the same universe while one is waiting changes nothing", () => {
    const waiting = applyEvents(submission(1));

    expect(reduceUniverseEditState(waiting, submission(2))).toBe(waiting);
  });

  it("a new submission clears the message of the earlier one", () => {
    const afterFailure = applyEvents(submission(1), {
      type: "requestFailed",
      universeId: EDITED_UNIVERSE_ID,
      requestId: 1,
      noticeCode: EDIT_NOTICE_CODES.failed,
    });

    const afterResubmission = reduceUniverseEditState(afterFailure, submission(2));

    expect(afterResubmission).toEqual({ universeId: EDITED_UNIVERSE_ID, blockingRequestId: 2, noticeCode: null });
  });
});

describe("universe edit state: the request ends", () => {
  it("an on-time success releases the form with no message", () => {
    const state = applyEvents(submission(1), {
      type: "requestSucceeded",
      universeId: EDITED_UNIVERSE_ID,
      requestId: 1,
    });

    expect(state).toEqual({ universeId: EDITED_UNIVERSE_ID, blockingRequestId: null, noticeCode: null });
  });

  it.each([
    ["the generic failure", EDIT_NOTICE_CODES.failed],
    ["the sign-in-again message", EDIT_NOTICE_CODES.signInAgain],
    ["the not-available message", EDIT_NOTICE_CODES.notAvailable],
    ["the unknown-result message", EDIT_NOTICE_CODES.resultUnknown],
  ])("a failure releases the form and shows %s", (_description, noticeCode) => {
    const state = applyEvents(submission(1), {
      type: "requestFailed",
      universeId: EDITED_UNIVERSE_ID,
      requestId: 1,
      noticeCode,
    });

    expect(state).toEqual({ universeId: EDITED_UNIVERSE_ID, blockingRequestId: null, noticeCode });
    expect(editNoticeFor(state, EDITED_UNIVERSE_ID)).toBe(noticeCode);
  });

  it("field errors release the form and show no message", () => {
    const state = applyEvents(submission(1), {
      type: "requestFailed",
      universeId: EDITED_UNIVERSE_ID,
      requestId: 1,
      noticeCode: null,
    });

    expect(state).toEqual({ universeId: EDITED_UNIVERSE_ID, blockingRequestId: null, noticeCode: null });
  });
});

describe("universe edit state: its own notice codes (FR-12)", () => {
  it("has one code per message, each different from the creation codes", () => {
    expect(EDIT_NOTICE_CODES).toEqual({
      failed: "EDIT_FAILED",
      resultUnknown: "EDIT_RESULT_UNKNOWN",
      confirmedAfterDelay: "EDIT_CONFIRMED_AFTER_DELAY",
      signInAgain: "EDIT_SIGN_IN_AGAIN",
      notAvailable: "EDIT_NOT_AVAILABLE",
    });
    const creationCodes: readonly string[] = Object.values(CREATION_NOTICE_CODES);
    for (const editCode of Object.values(EDIT_NOTICE_CODES)) {
      expect(creationCodes).not.toContain(editCode);
    }
  });

  it("the failure and the unknown-result messages have different codes", () => {
    expect(EDIT_NOTICE_CODES.failed).not.toBe(EDIT_NOTICE_CODES.resultUnknown);
  });
});

describe("universe edit state: no answer in 30 seconds (FR-12)", () => {
  it("shows the unknown-result message and keeps the form blocked while the request is alive", () => {
    const state = applyEvents(submission(1), { type: "answerIsLate", universeId: EDITED_UNIVERSE_ID, requestId: 1 });

    expect(state).toEqual({
      universeId: EDITED_UNIVERSE_ID,
      blockingRequestId: 1,
      noticeCode: EDIT_NOTICE_CODES.resultUnknown,
    });
    expect(isEditBlocked(state, EDITED_UNIVERSE_ID)).toBe(true);
  });

  it("a late success replaces the message with the confirmation and releases the form", () => {
    const state = applyEvents(
      submission(1),
      { type: "answerIsLate", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
      { type: "requestSucceeded", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
    );

    expect(state).toEqual({
      universeId: EDITED_UNIVERSE_ID,
      blockingRequestId: null,
      noticeCode: EDIT_NOTICE_CODES.confirmedAfterDelay,
    });
  });

  it("the late notice of a request that is not the blocking one is ignored", () => {
    const state = applyEvents(submission(2));

    expect(
      reduceUniverseEditState(state, { type: "answerIsLate", universeId: EDITED_UNIVERSE_ID, requestId: 1 }),
    ).toBe(state);
  });
});

describe("universe edit state: the 5-minute cap", () => {
  it("the cap is five minutes", () => {
    expect(EDIT_BLOCK_CAP_MILLISECONDS).toBe(5 * 60 * 1000);
  });

  it("releases the form and keeps the unknown-result message", () => {
    const state = applyEvents(
      submission(1),
      { type: "answerIsLate", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
      { type: "blockCapReached", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
    );

    expect(state).toEqual({
      universeId: EDITED_UNIVERSE_ID,
      blockingRequestId: null,
      noticeCode: EDIT_NOTICE_CODES.resultUnknown,
    });
    expect(isEditBlocked(state, EDITED_UNIVERSE_ID)).toBe(false);
  });

  it("does nothing when the request already ended", () => {
    const ended = applyEvents(submission(1), {
      type: "requestFailed",
      universeId: EDITED_UNIVERSE_ID,
      requestId: 1,
      noticeCode: EDIT_NOTICE_CODES.failed,
    });

    expect(
      reduceUniverseEditState(ended, { type: "blockCapReached", universeId: EDITED_UNIVERSE_ID, requestId: 1 }),
    ).toBe(ended);
  });

  it("accepts a second submission after the cap and does not release it with the cap of the first", () => {
    const state = applyEvents(
      submission(1),
      { type: "blockCapReached", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
      submission(2),
    );

    expect(state).toEqual({ universeId: EDITED_UNIVERSE_ID, blockingRequestId: 2, noticeCode: null });
    expect(
      reduceUniverseEditState(state, { type: "blockCapReached", universeId: EDITED_UNIVERSE_ID, requestId: 1 }),
    ).toBe(state);
  });

  it("an answer after the cap is a late success with the confirmation", () => {
    const state = applyEvents(
      submission(1),
      { type: "answerIsLate", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
      { type: "blockCapReached", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
      { type: "requestSucceeded", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
    );

    expect(state).toEqual({
      universeId: EDITED_UNIVERSE_ID,
      blockingRequestId: null,
      noticeCode: EDIT_NOTICE_CODES.confirmedAfterDelay,
    });
  });

  it("the late success of the first request leaves the second one blocking the form", () => {
    const state = applyEvents(
      submission(1),
      { type: "blockCapReached", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
      submission(2),
      { type: "requestSucceeded", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
    );

    expect(state).toEqual({
      universeId: EDITED_UNIVERSE_ID,
      blockingRequestId: 2,
      noticeCode: EDIT_NOTICE_CODES.confirmedAfterDelay,
    });
  });

  it("a failure after the cap leaves the state as it is", () => {
    const released = applyEvents(submission(1), {
      type: "blockCapReached",
      universeId: EDITED_UNIVERSE_ID,
      requestId: 1,
    });

    expect(
      reduceUniverseEditState(released, {
        type: "requestFailed",
        universeId: EDITED_UNIVERSE_ID,
        requestId: 1,
        noticeCode: EDIT_NOTICE_CODES.failed,
      }),
    ).toBe(released);
  });
});

describe("universe edit state: scoped to one universe (FR-12, spec 006 FR-12)", () => {
  it.each<[string, UniverseEditEvent]>([
    ["is late", { type: "answerIsLate", universeId: OTHER_UNIVERSE_ID, requestId: 1 }],
    ["reaches the cap", { type: "blockCapReached", universeId: OTHER_UNIVERSE_ID, requestId: 1 }],
    ["succeeds", { type: "requestSucceeded", universeId: OTHER_UNIVERSE_ID, requestId: 1 }],
    [
      "fails",
      { type: "requestFailed", universeId: OTHER_UNIVERSE_ID, requestId: 1, noticeCode: EDIT_NOTICE_CODES.failed },
    ],
  ])("a request of another universe that %s changes nothing", (_description, otherUniverseEvent) => {
    const state = applyEvents(submission(1), { type: "answerIsLate", universeId: EDITED_UNIVERSE_ID, requestId: 1 });

    expect(reduceUniverseEditState(state, otherUniverseEvent)).toBe(state);
  });

  it("a submission for another universe replaces the state, even while the first one blocks its form", () => {
    const state = applyEvents(
      submission(1),
      { type: "answerIsLate", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
      submission(2, OTHER_UNIVERSE_ID),
    );

    expect(state).toEqual({ universeId: OTHER_UNIVERSE_ID, blockingRequestId: 2, noticeCode: null });
    expect(isEditBlocked(state, EDITED_UNIVERSE_ID)).toBe(false);
  });

  it("the answer of the earlier universe's request never gives its message to the universe edited now", () => {
    const state = applyEvents(
      submission(1),
      { type: "answerIsLate", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
      submission(2, OTHER_UNIVERSE_ID),
      { type: "requestSucceeded", universeId: OTHER_UNIVERSE_ID, requestId: 2 },
      { type: "requestSucceeded", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
    );

    expect(state).toEqual({ universeId: OTHER_UNIVERSE_ID, blockingRequestId: null, noticeCode: null });
    expect(editNoticeFor(state, OTHER_UNIVERSE_ID)).toBeNull();
  });

  it("the message of one universe is never the message of another", () => {
    const state = applyEvents(submission(1), {
      type: "requestFailed",
      universeId: EDITED_UNIVERSE_ID,
      requestId: 1,
      noticeCode: EDIT_NOTICE_CODES.failed,
    });

    expect(editNoticeFor(state, EDITED_UNIVERSE_ID)).toBe(EDIT_NOTICE_CODES.failed);
    expect(editNoticeFor(state, OTHER_UNIVERSE_ID)).toBeNull();
  });
});

describe("universe edit state: opening the form", () => {
  it("clears a message left by an earlier form of the same universe", () => {
    const state = applyEvents(
      submission(1),
      { type: "requestFailed", universeId: EDITED_UNIVERSE_ID, requestId: 1, noticeCode: EDIT_NOTICE_CODES.failed },
      { type: "formOpened", universeId: EDITED_UNIVERSE_ID },
    );

    expect(state).toEqual({ universeId: EDITED_UNIVERSE_ID, blockingRequestId: null, noticeCode: null });
  });

  it("clears a late confirmation left after the form was closed", () => {
    const state = applyEvents(
      submission(1),
      { type: "blockCapReached", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
      { type: "requestSucceeded", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
      { type: "formOpened", universeId: EDITED_UNIVERSE_ID },
    );

    expect(editNoticeFor(state, EDITED_UNIVERSE_ID)).toBeNull();
  });

  it("keeps the message while a request of the same universe still blocks the form", () => {
    const state = applyEvents(submission(1), { type: "answerIsLate", universeId: EDITED_UNIVERSE_ID, requestId: 1 });

    expect(reduceUniverseEditState(state, { type: "formOpened", universeId: EDITED_UNIVERSE_ID })).toBe(state);
  });

  it("opening the form of another universe starts it with no message and no block, while the earlier request is alive", () => {
    const state = applyEvents(
      submission(1),
      { type: "answerIsLate", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
      { type: "formOpened", universeId: OTHER_UNIVERSE_ID },
    );

    expect(state).toEqual({ universeId: OTHER_UNIVERSE_ID, blockingRequestId: null, noticeCode: null });
  });

  it("after the form of another universe was opened, the earlier request's late success shows nothing", () => {
    const state = applyEvents(
      submission(1),
      { type: "answerIsLate", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
      { type: "formOpened", universeId: OTHER_UNIVERSE_ID },
      { type: "requestSucceeded", universeId: EDITED_UNIVERSE_ID, requestId: 1 },
    );

    expect(editNoticeFor(state, OTHER_UNIVERSE_ID)).toBeNull();
    expect(editNoticeFor(state, EDITED_UNIVERSE_ID)).toBeNull();
  });
});
