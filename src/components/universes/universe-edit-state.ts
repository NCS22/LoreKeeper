// The lifecycle of one universe edit on the screen, as a pure reducer (specs/007a-universe-editing/
// plan.md, section 5; FR-12). A sibling of universe-creation-state.ts with the same block, late event
// and cap, and its own notice codes. It lives apart from the form so a late answer is still applied
// when the form has been closed in the meantime.
//
// The state belongs to one universe: every event carries the universe identifier, an event of another
// universe never changes a message, and a submission or an opened form for another universe replaces
// the state. So a universe selected meanwhile never receives the message of an earlier universe's
// request (spec 006 FR-12); that earlier answer still reaches the navigation entry, outside this reducer.
//
// One request "blocks" the form from its submission until it ends or until the 5-minute cap, whichever
// comes first. After the cap the request may still be alive: its late answer is still applied.

/** How long an edit may block the form before it is released regardless of its answer. */
export const EDIT_BLOCK_CAP_MILLISECONDS = 5 * 60_000;

export const EDIT_NOTICE_CODES = {
  failed: "EDIT_FAILED",
  resultUnknown: "EDIT_RESULT_UNKNOWN",
  confirmedAfterDelay: "EDIT_CONFIRMED_AFTER_DELAY",
  signInAgain: "EDIT_SIGN_IN_AGAIN",
  notAvailable: "EDIT_NOT_AVAILABLE",
} as const;

export type EditNoticeCode = (typeof EDIT_NOTICE_CODES)[keyof typeof EDIT_NOTICE_CODES];

export type UniverseEditState = {
  /** The universe this state belongs to, or null before any edit form was opened or submitted. */
  readonly universeId: string | null;
  /** The request that keeps the form of that universe blocked, or null when it accepts a submission. */
  readonly blockingRequestId: number | null;
  /** The message about the last edit of that universe, or null when there is none to show. */
  readonly noticeCode: EditNoticeCode | null;
};

export const INITIAL_UNIVERSE_EDIT_STATE: UniverseEditState = {
  universeId: null,
  blockingRequestId: null,
  noticeCode: null,
};

export type UniverseEditEvent =
  /** The person submitted the form. Ignored while another request of the same universe blocks it. */
  | { readonly type: "submissionStarted"; readonly universeId: string; readonly requestId: number }
  /** The 30 seconds passed with no answer; the request is still alive and keeps the form blocked. */
  | { readonly type: "answerIsLate"; readonly universeId: string; readonly requestId: number }
  /** The 5 minutes since the submission passed. */
  | { readonly type: "blockCapReached"; readonly universeId: string; readonly requestId: number }
  /** The answer says the universe was saved. */
  | { readonly type: "requestSucceeded"; readonly universeId: string; readonly requestId: number }
  /** The answer says nothing was saved, or no usable answer will come. `noticeCode` is null for field errors. */
  | {
      readonly type: "requestFailed";
      readonly universeId: string;
      readonly requestId: number;
      readonly noticeCode: EditNoticeCode | null;
    }
  /** The form was opened: a message left from an earlier form goes, unless a request of that universe still blocks it. */
  | { readonly type: "formOpened"; readonly universeId: string };

export function reduceUniverseEditState(state: UniverseEditState, event: UniverseEditEvent): UniverseEditState {
  if (event.type === "submissionStarted") {
    return isEditBlocked(state, event.universeId)
      ? state
      : { universeId: event.universeId, blockingRequestId: event.requestId, noticeCode: null };
  }
  if (event.type === "formOpened") {
    // While a request blocks the form its message still tells the person why. A form of another
    // universe is never blocked by this request, so it starts clean.
    return isEditBlocked(state, event.universeId)
      ? state
      : { universeId: event.universeId, blockingRequestId: null, noticeCode: null };
  }
  // An answer or a timer of another universe's request never changes the message of this one.
  if (!belongsTo(state, event.universeId)) {
    return state;
  }
  switch (event.type) {
    case "answerIsLate":
      return isBlocking(state, event.requestId)
        ? { ...state, noticeCode: EDIT_NOTICE_CODES.resultUnknown }
        : state;
    case "blockCapReached":
      return isBlocking(state, event.requestId)
        ? { ...state, blockingRequestId: null, noticeCode: EDIT_NOTICE_CODES.resultUnknown }
        : state;
    case "requestSucceeded":
      return {
        ...state,
        blockingRequestId: releasedBy(state, event.requestId),
        noticeCode: noticeAfterSuccess(state, event.requestId),
      };
    case "requestFailed":
      // A failure that arrives after the form was released says nothing the person still needs: the
      // unknown-result message stays, and a new submission may already be running.
      return isBlocking(state, event.requestId)
        ? { ...state, blockingRequestId: null, noticeCode: event.noticeCode }
        : state;
  }
}

/** True while the form of that universe must not accept a new submission. */
export function isEditBlocked(state: UniverseEditState, universeId: string): boolean {
  return belongsTo(state, universeId) && state.blockingRequestId !== null;
}

/** The message to show in the edit form of that universe; never the message of another universe. */
export function editNoticeFor(state: UniverseEditState, universeId: string): EditNoticeCode | null {
  return belongsTo(state, universeId) ? state.noticeCode : null;
}

function belongsTo(state: UniverseEditState, universeId: string): boolean {
  return state.universeId === universeId;
}

function isBlocking(state: UniverseEditState, requestId: number): boolean {
  return state.blockingRequestId === requestId;
}

function releasedBy(state: UniverseEditState, requestId: number): number | null {
  return isBlocking(state, requestId) ? null : state.blockingRequestId;
}

// A success is a plain success when the person was still waiting for a normal answer. It is a late
// success, with its confirmation, when the unknown-result message was shown or the form was already
// released (FR-12).
function noticeAfterSuccess(state: UniverseEditState, requestId: number): EditNoticeCode | null {
  const wasLate = !isBlocking(state, requestId) || state.noticeCode === EDIT_NOTICE_CODES.resultUnknown;
  return wasLate ? EDIT_NOTICE_CODES.confirmedAfterDelay : null;
}
