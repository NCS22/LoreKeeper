"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createWorkAction, loadUniverseKnowledgeAction } from "@/app/knowledge/actions";
import { leaveAccountPage } from "@/components/accounts/leave-account-page";
import { runWithTimeLimit, type TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";
import {
  interpretCreateWorkResult,
  interpretLoadUniverseKnowledgeResult,
  type WorkCreationOutcome,
} from "@/components/knowledge/interpret-knowledge-action-result";
import type { KnowledgeFormVocabulary } from "@/components/knowledge/knowledge-form-vocabulary";
import {
  INITIAL_KNOWLEDGE_LOAD_STATE,
  readKnowledgeLoadOf,
  reduceKnowledgeLoadState,
  type KnowledgeLoad,
} from "@/components/knowledge/knowledge-load-state";
import {
  CREATION_BLOCK_CAP_MILLISECONDS,
  CREATION_NOTICE_CODES,
  INITIAL_UNIVERSE_CREATION_STATE,
  isCreationBlocked,
  reduceUniverseCreationState,
  type CreationNoticeCode,
  type UniverseCreationEvent,
  type UniverseCreationState,
} from "@/components/universes/universe-creation-state";
import { settleActionCall, useUniverses } from "@/components/universes/universes-provider";
import { useWorkspaceState } from "@/components/workspace/workspace-state";

/** What the work form sends; the universe is always the selected one. */
export type WorkFormValues = {
  readonly title: string;
  readonly medium: string;
  readonly unitCount: string;
};

type KnowledgeContextValue = {
  vocabulary: KnowledgeFormVocabulary;
  /** What the screen shows of the selected universe, or null when no universe is selected. */
  knowledgeLoad: KnowledgeLoad | null;
  /** Loads the selected universe again, after a failed load. */
  retryKnowledgeLoad: () => void;
  /** True while a creation of the selected universe keeps the knowledge forms from sending another. */
  isCreationBlocked: boolean;
  creationNoticeCode: CreationNoticeCode | null;
  /**
   * Creates a work in the selected universe. Resolves with how the request ended, or with `null` when
   * there is nothing for the form to do: another request blocks it, the answer of a released request
   * arrives, or the answer belongs to a universe that is no longer selected (FR-12).
   */
  createWork: (values: WorkFormValues) => Promise<WorkCreationOutcome | null>;
  dismissCreationNotice: () => void;
};

const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

type KnowledgeProviderProps = {
  children: ReactNode;
  vocabulary: KnowledgeFormVocabulary;
};

// Must sit inside the universes provider: it follows the selected universe and uses the tab account
// guard of that provider before every creation (specs/006-knowledge-items/plan.md, section 5). The reads
// are Server Actions called from here (D8), the first load included (D9). Every answer is applied only
// for the universe it was asked for, and discarded without any message when another one is selected (D12).
export function KnowledgeProvider({ children, vocabulary }: KnowledgeProviderProps) {
  const { state: workspaceState } = useWorkspaceState();
  const { confirmAccountBeforeSending, signInAddress } = useUniverses();
  const selectedUniverseId = workspaceState.selectedUniverseId;
  const [loadState, dispatchLoadEvent] = useReducer(reduceKnowledgeLoadState, INITIAL_KNOWLEDGE_LOAD_STATE);
  const lastLoadRequestIdRef = useRef(0);
  // Read when an answer arrives, to know whether its universe is still the selected one.
  const selectedUniverseIdRef = useRef(selectedUniverseId);
  const [creationState, setCreationState] = useState<UniverseCreationState>(INITIAL_UNIVERSE_CREATION_STATE);
  // As in the universes provider, the reducer runs in the callbacks so a second submission sees the
  // blocked state at once.
  const creationStateRef = useRef<UniverseCreationState>(INITIAL_UNIVERSE_CREATION_STATE);
  const [creationUniverseId, setCreationUniverseId] = useState<string | null>(null);
  const creationUniverseIdRef = useRef<string | null>(null);
  const lastCreationRequestIdRef = useRef(0);

  useEffect(() => {
    selectedUniverseIdRef.current = selectedUniverseId;
  }, [selectedUniverseId]);

  const loadKnowledge = useCallback(
    async (universeId: string) => {
      lastLoadRequestIdRef.current += 1;
      const requestId = lastLoadRequestIdRef.current;
      dispatchLoadEvent({ type: "loadRequested", universeId, requestId });

      const outcome = interpretLoadUniverseKnowledgeResult(
        await runWithTimeLimit(() => loadUniverseKnowledgeAction({ universeId })),
        vocabulary,
      );
      if (outcome.status === "signed-out") {
        leaveAccountPage(signInAddress);
        return;
      }
      dispatchLoadEvent(
        outcome.status === "loaded"
          ? { type: "loadSucceeded", universeId, requestId, knowledge: outcome.knowledge }
          : { type: "loadFailed", universeId, requestId },
      );
    },
    [vocabulary, signInAddress],
  );

  // The same path for the first load and for every change of universe (D9).
  useEffect(() => {
    if (selectedUniverseId !== null) void loadKnowledge(selectedUniverseId);
  }, [selectedUniverseId, loadKnowledge]);

  const retryKnowledgeLoad = useCallback(() => {
    if (selectedUniverseIdRef.current !== null) void loadKnowledge(selectedUniverseIdRef.current);
  }, [loadKnowledge]);

  const applyCreationEvent = useCallback((event: UniverseCreationEvent) => {
    creationStateRef.current = reduceUniverseCreationState(creationStateRef.current, event);
    setCreationState(creationStateRef.current);
  }, []);

  const waitForCreationEnd = useCallback(
    async (requestId: number, settledEnd: Promise<TimeLimitedOutcome<unknown>>) => {
      const firstOutcome = await runWithTimeLimit(() => settledEnd);
      if (firstOutcome.status === "answered") return firstOutcome.value;
      if (firstOutcome.status === "rejected") return firstOutcome;

      // No answer in 30 seconds: the request stays alive and keeps the forms blocked (004 FR-8).
      applyCreationEvent({ type: "answerIsLate", requestId });
      return settledEnd;
    },
    [applyCreationEvent],
  );

  const finishWorkCreation = useCallback(
    (requestId: number, universeId: string, outcome: WorkCreationOutcome): WorkCreationOutcome | null => {
      if (universeId !== selectedUniverseIdRef.current) {
        // Another universe is selected: the answer is discarded without any message. A stored work
        // appears when the person goes back, because the selection loads the universe again (FR-12).
        applyCreationEvent({ type: "requestFailed", requestId, noticeCode: null });
        return null;
      }

      const wasBlocking = creationStateRef.current.blockingRequestId === requestId;
      if (outcome.status === "created") {
        applyCreationEvent({ type: "requestSucceeded", requestId });
        void loadKnowledge(universeId);
        return outcome;
      }

      applyCreationEvent({ type: "requestFailed", requestId, noticeCode: noticeCodeOfFailure(outcome) });
      // The failure of a request that was already released is no news to the form.
      return wasBlocking ? outcome : null;
    },
    [applyCreationEvent, loadKnowledge],
  );

  const createWork = useCallback(
    async (values: WorkFormValues): Promise<WorkCreationOutcome | null> => {
      const universeId = selectedUniverseIdRef.current;
      if (universeId === null) return null;
      const blockingRequestId = creationStateRef.current.blockingRequestId;
      if (blockingRequestId !== null) {
        if (creationUniverseIdRef.current === universeId) return null;
        // A request of a universe that is no longer selected does not block this one; it is released
        // without any message (FR-12).
        applyCreationEvent({ type: "requestFailed", requestId: blockingRequestId, noticeCode: null });
      }

      lastCreationRequestIdRef.current += 1;
      const requestId = lastCreationRequestIdRef.current;
      creationUniverseIdRef.current = universeId;
      setCreationUniverseId(universeId);
      applyCreationEvent({ type: "submissionStarted", requestId });
      const blockCapTimerId = setTimeout(
        () => applyCreationEvent({ type: "blockCapReached", requestId }),
        CREATION_BLOCK_CAP_MILLISECONDS,
      );

      try {
        const decision = await confirmAccountBeforeSending();
        // Another account acts now: the page is leaving and sends nothing under it.
        if (decision === "replace-document") return null;
        if (decision === "signed-out") return finishWorkCreation(requestId, universeId, { status: "sign-in-again" });

        const settledEnd = settleActionCall(() => createWorkAction({ universeId, ...values }));
        const end = await waitForCreationEnd(requestId, settledEnd);
        return finishWorkCreation(requestId, universeId, interpretCreateWorkResult(end, vocabulary));
      } finally {
        clearTimeout(blockCapTimerId);
      }
    },
    [applyCreationEvent, confirmAccountBeforeSending, finishWorkCreation, vocabulary, waitForCreationEnd],
  );

  const dismissCreationNotice = useCallback(() => applyCreationEvent({ type: "noticeDismissed" }), [applyCreationEvent]);

  // The creation state belongs to the universe of its last submission: in another universe nothing of
  // it is shown and nothing blocks.
  const creationBelongsToSelectedUniverse = creationUniverseId !== null && creationUniverseId === selectedUniverseId;

  const contextValue = useMemo(
    () => ({
      vocabulary,
      knowledgeLoad: selectedUniverseId === null ? null : readKnowledgeLoadOf(loadState, selectedUniverseId),
      retryKnowledgeLoad,
      isCreationBlocked: creationBelongsToSelectedUniverse && isCreationBlocked(creationState),
      creationNoticeCode: creationBelongsToSelectedUniverse ? creationState.noticeCode : null,
      createWork,
      dismissCreationNotice,
    }),
    [
      vocabulary,
      selectedUniverseId,
      loadState,
      retryKnowledgeLoad,
      creationBelongsToSelectedUniverse,
      creationState,
      createWork,
      dismissCreationNotice,
    ],
  );

  return <KnowledgeContext.Provider value={contextValue}>{children}</KnowledgeContext.Provider>;
}

export function useKnowledge(): KnowledgeContextValue {
  const contextValue = useContext(KnowledgeContext);
  if (contextValue === null) {
    throw new Error("useKnowledge must be used inside KnowledgeProvider");
  }
  return contextValue;
}

/** How the creation request failed, as the message code the form shows; field errors show none. */
function noticeCodeOfFailure(outcome: Exclude<WorkCreationOutcome, { status: "created" }>): CreationNoticeCode | null {
  switch (outcome.status) {
    case "field-errors":
      return null;
    case "sign-in-again":
      return CREATION_NOTICE_CODES.signInAgain;
    case "generic-failure":
      return CREATION_NOTICE_CODES.failed;
    case "result-unknown":
      return CREATION_NOTICE_CODES.resultUnknown;
  }
}
