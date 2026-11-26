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
import { createEntityAction, createWorkAction, loadUniverseKnowledgeAction } from "@/app/knowledge/actions";
import { leaveAccountPage } from "@/components/accounts/leave-account-page";
import { runWithTimeLimit, type TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";
import {
  interpretCreateEntityResult,
  interpretCreateWorkResult,
  interpretLoadUniverseKnowledgeResult,
  type EntityCreationOutcome,
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
import { useWorkspaceState, type KnowledgeForm } from "@/components/workspace/workspace-state";

/** What the work form sends; the universe is always the selected one. */
export type WorkFormValues = {
  readonly title: string;
  readonly medium: string;
  readonly unitCount: string;
};

/** A point as the entity form sends it: the unit number goes as typed (plan section 4, D6). */
export type PointFormValues = {
  readonly workId: string;
  readonly unitNumber: string;
};

/** What the entity form sends; the universe is always the selected one. */
export type EntityFormValues = {
  readonly name: string;
  readonly type: string;
  readonly boundary: PointFormValues;
  /** The first fragment as typed; without a boundary it takes the point of the entity (FR-5). */
  readonly fragment: {
    readonly content: string;
    readonly status: string;
    readonly boundary: PointFormValues | null;
  };
};

/** The kind of item of the last creation, so its messages name it. */
export type KnowledgeCreationKind = "work" | "entity";

type KnowledgeCreationOutcome = WorkCreationOutcome | EntityCreationOutcome;

/** A creation that was submitted: its request, its universe and the timer of its block cap. */
type PendingCreation = {
  readonly requestId: number;
  readonly universeId: string;
  readonly blockCapTimerId: ReturnType<typeof setTimeout>;
};

/** How sending a creation ended, before its answer is read. */
type CreationSendingEnd =
  | { readonly kind: "answered"; readonly end: TimeLimitedOutcome<unknown> }
  /** The tab account guard found no session: nothing was sent. */
  | { readonly kind: "signed-out" }
  /** Another account acts now: the page is leaving and sends nothing under it. */
  | { readonly kind: "not-sent" };

/** The notice of FR-6, kept with the universe and the entity whose creation it answered. */
type SimilarEntityNotice = {
  readonly universeId: string;
  readonly createdEntityId: string;
  readonly similarEntityName: string;
};

/** What the notice of FR-6 follows: it ends when a form opens, another entity is selected or the universe changes. */
type ObservedWorkspace = {
  readonly selectedUniverseId: string | null;
  readonly knowledgeForm: KnowledgeForm | null;
  readonly selectedEntityId: string | null;
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
  /** The kind of item of the last creation of the selected universe, or null when there was none. */
  creationKind: KnowledgeCreationKind | null;
  /** The name of the similar entity the last entity creation reported, while its notice stays (FR-6). */
  similarEntityName: string | null;
  /**
   * Creates a work in the selected universe. Resolves with how the request ended, or with `null` when
   * there is nothing for the form to do: another request blocks it, the answer of a released request
   * arrives, or the answer belongs to a universe that is no longer selected (FR-12).
   */
  createWork: (values: WorkFormValues) => Promise<WorkCreationOutcome | null>;
  /** Creates an entity, with its optional first fragment, in the selected universe; resolves as `createWork`. */
  createEntity: (values: EntityFormValues) => Promise<EntityCreationOutcome | null>;
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
  const [creationKind, setCreationKind] = useState<KnowledgeCreationKind | null>(null);
  const lastCreationRequestIdRef = useRef(0);
  const [similarEntityNotice, setSimilarEntityNotice] = useState<SimilarEntityNotice | null>(null);
  const currentWorkspace: ObservedWorkspace = {
    selectedUniverseId,
    knowledgeForm: workspaceState.knowledgeForm,
    selectedEntityId: workspaceState.selectedEntityId,
  };
  const [observedWorkspace, setObservedWorkspace] = useState<ObservedWorkspace>(currentWorkspace);
  if (!isSameWorkspace(observedWorkspace, currentWorkspace)) {
    // Adjusted while rendering, the way React recommends for state that follows other state.
    setObservedWorkspace(currentWorkspace);
    if (similarEntityNotice !== null && endsSimilarEntityNotice(observedWorkspace, currentWorkspace, similarEntityNotice)) {
      setSimilarEntityNotice(null);
    }
  }

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

  const finishCreation = useCallback(
    function finishCreation<Outcome extends KnowledgeCreationOutcome>(
      creation: PendingCreation,
      outcome: Outcome,
    ): Outcome | null {
      const { requestId, universeId } = creation;
      if (universeId !== selectedUniverseIdRef.current) {
        // Another universe is selected: the answer is discarded without any message. A stored item
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

  /** Starts a creation in the selected universe, or returns null when a request of it blocks the forms. */
  const beginCreation = useCallback(
    (kind: KnowledgeCreationKind): PendingCreation | null => {
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
      setCreationKind(kind);
      applyCreationEvent({ type: "submissionStarted", requestId });
      const blockCapTimerId = setTimeout(
        () => applyCreationEvent({ type: "blockCapReached", requestId }),
        CREATION_BLOCK_CAP_MILLISECONDS,
      );
      return { requestId, universeId, blockCapTimerId };
    },
    [applyCreationEvent],
  );

  /** Passes the tab account guard and sends the creation, waiting for its answer as long as it lives. */
  const sendCreation = useCallback(
    async (creation: PendingCreation, callAction: () => Promise<unknown>): Promise<CreationSendingEnd> => {
      const decision = await confirmAccountBeforeSending();
      if (decision === "replace-document") return { kind: "not-sent" };
      if (decision === "signed-out") return { kind: "signed-out" };

      const end = await waitForCreationEnd(creation.requestId, settleActionCall(callAction));
      return { kind: "answered", end };
    },
    [confirmAccountBeforeSending, waitForCreationEnd],
  );

  const createWork = useCallback(
    async (values: WorkFormValues): Promise<WorkCreationOutcome | null> => {
      const creation = beginCreation("work");
      if (creation === null) return null;
      try {
        const sendingEnd = await sendCreation(creation, () =>
          createWorkAction({ universeId: creation.universeId, ...values }),
        );
        if (sendingEnd.kind === "not-sent") return null;
        return finishCreation<WorkCreationOutcome>(
          creation,
          sendingEnd.kind === "signed-out"
            ? { status: "sign-in-again" }
            : interpretCreateWorkResult(sendingEnd.end, vocabulary),
        );
      } finally {
        clearTimeout(creation.blockCapTimerId);
      }
    },
    [beginCreation, finishCreation, sendCreation, vocabulary],
  );

  const createEntity = useCallback(
    async (values: EntityFormValues): Promise<EntityCreationOutcome | null> => {
      const creation = beginCreation("entity");
      if (creation === null) return null;
      try {
        const sendingEnd = await sendCreation(creation, () =>
          createEntityAction({ universeId: creation.universeId, ...values }),
        );
        if (sendingEnd.kind === "not-sent") return null;
        const outcome = finishCreation<EntityCreationOutcome>(
          creation,
          sendingEnd.kind === "signed-out"
            ? { status: "sign-in-again" }
            : interpretCreateEntityResult(sendingEnd.end, vocabulary),
        );
        // The notice belongs to the answer, so it also appears when the answer arrives late (FR-6).
        if (outcome?.status === "created") {
          setSimilarEntityNotice(
            outcome.similarEntityName === null
              ? null
              : {
                  universeId: creation.universeId,
                  createdEntityId: outcome.entity.id,
                  similarEntityName: outcome.similarEntityName,
                },
          );
        }
        return outcome;
      } finally {
        clearTimeout(creation.blockCapTimerId);
      }
    },
    [beginCreation, finishCreation, sendCreation, vocabulary],
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
      creationKind: creationBelongsToSelectedUniverse ? creationKind : null,
      similarEntityName:
        similarEntityNotice !== null && similarEntityNotice.universeId === selectedUniverseId
          ? similarEntityNotice.similarEntityName
          : null,
      createWork,
      createEntity,
      dismissCreationNotice,
    }),
    [
      vocabulary,
      selectedUniverseId,
      loadState,
      retryKnowledgeLoad,
      creationBelongsToSelectedUniverse,
      creationState,
      creationKind,
      similarEntityNotice,
      createWork,
      createEntity,
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

function isSameWorkspace(first: ObservedWorkspace, second: ObservedWorkspace): boolean {
  return (
    first.selectedUniverseId === second.selectedUniverseId &&
    first.knowledgeForm === second.knowledgeForm &&
    first.selectedEntityId === second.selectedEntityId
  );
}

/**
 * The notice of FR-6 stays until another form is opened, another entity is selected or the selected
 * universe changes. Closing the entity form and selecting the created entity, which the creation itself
 * does, keep it.
 */
function endsSimilarEntityNotice(
  previous: ObservedWorkspace,
  current: ObservedWorkspace,
  notice: SimilarEntityNotice,
): boolean {
  const universeChanged = current.selectedUniverseId !== previous.selectedUniverseId;
  const formOpened = current.knowledgeForm !== null && current.knowledgeForm !== previous.knowledgeForm;
  const otherEntitySelected =
    current.selectedEntityId !== previous.selectedEntityId && current.selectedEntityId !== notice.createdEntityId;
  return universeChanged || formOpened || otherEntitySelected;
}

/** How the creation request failed, as the message code the form shows; field errors show none. */
function noticeCodeOfFailure(
  outcome: Exclude<KnowledgeCreationOutcome, { status: "created" }>,
): CreationNoticeCode | null {
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
