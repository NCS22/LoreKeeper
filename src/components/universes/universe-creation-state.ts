// The lifecycle of universe creation on the screen, as a pure reducer (specs/004-stored-universes/
// plan.md, sections 4 and 5; FR-8, FR-9, FR-10). It lives apart from the form so a late answer is
// still applied when the form has been closed in the meantime.
//
// One request "blocks" the form from its submission until it ends or until the 5-minute cap, whichever
// comes first. After the cap the request may still be alive: its late answer is still applied.

/** How long a creation may block the form before it is released regardless of its answer (D17). */
export const CREATION_BLOCK_CAP_MILLISECONDS = 5 * 60_000;

export const CREATION_NOTICE_CODES = {
  failed: "CREATION_FAILED",
  resultUnknown: "CREATION_RESULT_UNKNOWN",
  confirmedAfterDelay: "CREATION_CONFIRMED_AFTER_DELAY",
  signInAgain: "CREATION_SIGN_IN_AGAIN",
} as const;

export type CreationNoticeCode = (typeof CREATION_NOTICE_CODES)[keyof typeof CREATION_NOTICE_CODES];

export type UniverseCreationState = {
  /** The request that keeps the form blocked, or null when the form accepts a submission. */
  readonly blockingRequestId: number | null;
  /** The message about the last creation, or null when there is none to show. */
  readonly noticeCode: CreationNoticeCode | null;
};

export const INITIAL_UNIVERSE_CREATION_STATE: UniverseCreationState = {
  blockingRequestId: null,
  noticeCode: null,
};

export type UniverseCreationEvent =
  /** The person submitted the form. Ignored while another request blocks it. */
  | { readonly type: "submissionStarted"; readonly requestId: number }
  /** The 30 seconds passed with no answer; the request is still alive and keeps the form blocked. */
  | { readonly type: "answerIsLate"; readonly requestId: number }
  /** The 5 minutes since the submission passed. */
  | { readonly type: "blockCapReached"; readonly requestId: number }
  /** The answer says the universe was created. */
  | { readonly type: "requestSucceeded"; readonly requestId: number }
  /** The answer says nothing was created, or no usable answer will come. `noticeCode` is null for field errors. */
  | { readonly type: "requestFailed"; readonly requestId: number; readonly noticeCode: CreationNoticeCode | null }
  /** The form was opened again: a message left from an earlier form goes, unless a request still blocks it. */
  | { readonly type: "noticeDismissed" };

export function reduceUniverseCreationState(
  state: UniverseCreationState,
  event: UniverseCreationEvent,
): UniverseCreationState {
  switch (event.type) {
    case "submissionStarted":
      return state.blockingRequestId === null
        ? { blockingRequestId: event.requestId, noticeCode: null }
        : state;
    case "answerIsLate":
      return isBlocking(state, event.requestId)
        ? { ...state, noticeCode: CREATION_NOTICE_CODES.resultUnknown }
        : state;
    case "blockCapReached":
      return isBlocking(state, event.requestId)
        ? { blockingRequestId: null, noticeCode: CREATION_NOTICE_CODES.resultUnknown }
        : state;
    case "requestSucceeded":
      return { blockingRequestId: releasedBy(state, event.requestId), noticeCode: noticeAfterSuccess(state, event.requestId) };
    case "requestFailed":
      // A failure that arrives after the form was released says nothing the person still needs: the
      // unknown-result message stays, and a new submission may already be running.
      return isBlocking(state, event.requestId)
        ? { blockingRequestId: null, noticeCode: event.noticeCode }
        : state;
    case "noticeDismissed":
      // While a request blocks the form its message still tells the person why.
      return state.blockingRequestId === null ? { ...state, noticeCode: null } : state;
  }
}

/** True while the form must not accept a new submission. */
export function isCreationBlocked(state: UniverseCreationState): boolean {
  return state.blockingRequestId !== null;
}

function isBlocking(state: UniverseCreationState, requestId: number): boolean {
  return state.blockingRequestId === requestId;
}

function releasedBy(state: UniverseCreationState, requestId: number): number | null {
  return isBlocking(state, requestId) ? null : state.blockingRequestId;
}

// A success is a plain success when the person was still waiting for a normal answer. It is a late
// success, with its confirmation, when the unknown-result message was shown or the form was already
// released (FR-8).
function noticeAfterSuccess(state: UniverseCreationState, requestId: number): CreationNoticeCode | null {
  const wasLate = !isBlocking(state, requestId) || state.noticeCode === CREATION_NOTICE_CODES.resultUnknown;
  return wasLate ? CREATION_NOTICE_CODES.confirmedAfterDelay : null;
}
