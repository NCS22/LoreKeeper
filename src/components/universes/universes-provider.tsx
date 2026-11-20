"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createUniverseAction,
  isUniverseNameInUseAction,
  rememberUniverseAction,
} from "@/app/universes/actions";
import { leaveAccountPage } from "@/components/accounts/leave-account-page";
import { runWithTimeLimit, type TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";
import { insertUniverseInCreationOrder } from "@/components/universes/insert-universe-in-creation-order";
import {
  interpretCreateUniverseResult,
  interpretNameCheckResult,
  interpretRememberResult,
  type CreationOutcome,
} from "@/components/universes/interpret-universe-action-result";
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
import type { UniverseFormVocabulary } from "@/components/universes/universe-form-vocabulary";
import { useAccountGuard } from "@/components/universes/use-account-guard";
import { useWorkspaceState } from "@/components/workspace/workspace-state";
import type { CreateUniverseCommand, UniverseDto } from "@/modules/universes";

type UniversesContextValue = {
  /** The own universes, in creation order. */
  universes: readonly UniverseDto[];
  vocabulary: UniverseFormVocabulary;
  /** Where the sign-in page is, for the message that asks the person to sign in again (FR-10). */
  signInAddress: string;
  /** True while a creation keeps the form from accepting another one (FR-8, FR-9). */
  isCreationBlocked: boolean;
  creationNoticeCode: CreationNoticeCode | null;
  /**
   * Creates a universe. Resolves with how the request ended, or with `null` when there is nothing for
   * the form to do: another request blocks it, or the answer of a request that was released arrives.
   * A success also adds, selects and remembers the universe.
   */
  createUniverse: (command: CreateUniverseCommand) => Promise<CreationOutcome | null>;
  /** Tells whether the account has a universe with this name; never fails, a failed check says no. */
  isUniverseNameInUse: (name: string) => Promise<boolean>;
  /** Selects one of the universes and stores it as the remembered one, silently (FR-25, FR-30). */
  selectUniverse: (universeId: string) => void;
  dismissCreationNotice: () => void;
};

const UniversesContext = createContext<UniversesContextValue | null>(null);

type UniversesProviderProps = {
  children: ReactNode;
  initialUniverses: readonly UniverseDto[];
  /** The account the server rendered this page for (FR-18). */
  accountKey: string;
  signInAddress: string;
  vocabulary: UniverseFormVocabulary;
};

// Must sit inside the workspace state provider: a created universe is selected from here, so a late
// answer selects it even when the form was closed meanwhile (FR-8).
export function UniversesProvider({
  children,
  initialUniverses,
  accountKey,
  signInAddress,
  vocabulary,
}: UniversesProviderProps) {
  const { state: workspaceState, dispatch: dispatchWorkspaceAction } = useWorkspaceState();
  const { confirmAccountBeforeSending } = useAccountGuard(accountKey);
  const [universes, setUniverses] = useState<readonly UniverseDto[]>(initialUniverses);
  const [creationState, setCreationState] = useState<UniverseCreationState>(INITIAL_UNIVERSE_CREATION_STATE);
  // The reducer runs in the callbacks so a second submission, by click, Enter or both, sees the
  // blocked state at once: a state update arrives only after the next event could already have run.
  const creationStateRef = useRef<UniverseCreationState>(INITIAL_UNIVERSE_CREATION_STATE);
  const lastRequestIdRef = useRef(0);

  const applyCreationEvent = useCallback((event: UniverseCreationEvent) => {
    creationStateRef.current = reduceUniverseCreationState(creationStateRef.current, event);
    setCreationState(creationStateRef.current);
  }, []);

  const rememberUniverseQuietly = useCallback(
    async (universeId: string) => {
      const decision = await confirmAccountBeforeSending();
      if (decision === "replace-document") return;
      if (decision === "signed-out") {
        leaveAccountPage(signInAddress);
        return;
      }

      const outcome = interpretRememberResult(await runWithTimeLimit(() => rememberUniverseAction({ universeId })));
      if (outcome === "signed-out") leaveAccountPage(signInAddress);
    },
    [confirmAccountBeforeSending, signInAddress],
  );

  const selectUniverse = useCallback(
    (universeId: string) => {
      dispatchWorkspaceAction({ type: "universeSelected", universeId });
      if (universeId !== workspaceState.selectedUniverseId) void rememberUniverseQuietly(universeId);
    },
    [dispatchWorkspaceAction, workspaceState.selectedUniverseId, rememberUniverseQuietly],
  );

  const waitForCreationEnd = useCallback(
    async (requestId: number, settledEnd: Promise<TimeLimitedOutcome<unknown>>) => {
      const firstOutcome = await runWithTimeLimit(() => settledEnd);
      if (firstOutcome.status === "answered") return firstOutcome.value;
      if (firstOutcome.status === "rejected") return firstOutcome;

      // No answer in 30 seconds: the request stays alive and keeps the form blocked (FR-8).
      applyCreationEvent({ type: "answerIsLate", requestId });
      return settledEnd;
    },
    [applyCreationEvent],
  );

  const finishCreation = useCallback(
    (requestId: number, outcome: CreationOutcome): CreationOutcome | null => {
      const wasBlocking = creationStateRef.current.blockingRequestId === requestId;

      if (outcome.status === "created") {
        applyCreationEvent({ type: "requestSucceeded", requestId });
        setUniverses((currentUniverses) => insertUniverseInCreationOrder(currentUniverses, outcome.universe));
        dispatchWorkspaceAction({ type: "universeCreated", universeId: outcome.universe.id });
        // Remembering is a second request on purpose: its failure never undoes a creation (FR-30).
        void rememberUniverseQuietly(outcome.universe.id);
        return outcome;
      }

      applyCreationEvent({ type: "requestFailed", requestId, noticeCode: noticeCodeOfFailure(outcome) });
      // The failure of a request that was already released is no news to the form.
      return wasBlocking ? outcome : null;
    },
    [applyCreationEvent, dispatchWorkspaceAction, rememberUniverseQuietly],
  );

  const createUniverse = useCallback(
    async (command: CreateUniverseCommand): Promise<CreationOutcome | null> => {
      if (creationStateRef.current.blockingRequestId !== null) return null;

      lastRequestIdRef.current += 1;
      const requestId = lastRequestIdRef.current;
      applyCreationEvent({ type: "submissionStarted", requestId });
      const blockCapTimerId = setTimeout(
        () => applyCreationEvent({ type: "blockCapReached", requestId }),
        CREATION_BLOCK_CAP_MILLISECONDS,
      );

      try {
        const decision = await confirmAccountBeforeSending();
        // Another account acts now: the page is leaving and sends nothing under it.
        if (decision === "replace-document") return null;
        if (decision === "signed-out") return finishCreation(requestId, { status: "sign-in-again" });

        const settledEnd = settleActionCall(() => createUniverseAction(command));
        const end = await waitForCreationEnd(requestId, settledEnd);
        return finishCreation(requestId, interpretCreateUniverseResult(end, vocabulary));
      } finally {
        clearTimeout(blockCapTimerId);
      }
    },
    [applyCreationEvent, confirmAccountBeforeSending, finishCreation, vocabulary, waitForCreationEnd],
  );

  const isUniverseNameInUse = useCallback(
    async (name: string): Promise<boolean> => {
      const outcome = interpretNameCheckResult(await runWithTimeLimit(() => isUniverseNameInUseAction({ name })));
      if (outcome === "signed-out") leaveAccountPage(signInAddress);
      return outcome === "in-use";
    },
    [signInAddress],
  );

  const dismissCreationNotice = useCallback(() => applyCreationEvent({ type: "noticeDismissed" }), [applyCreationEvent]);

  const contextValue = useMemo(
    () => ({
      universes,
      vocabulary,
      signInAddress,
      isCreationBlocked: isCreationBlocked(creationState),
      creationNoticeCode: creationState.noticeCode,
      createUniverse,
      isUniverseNameInUse,
      selectUniverse,
      dismissCreationNotice,
    }),
    [
      universes,
      vocabulary,
      signInAddress,
      creationState,
      createUniverse,
      isUniverseNameInUse,
      selectUniverse,
      dismissCreationNotice,
    ],
  );

  return <UniversesContext.Provider value={contextValue}>{children}</UniversesContext.Provider>;
}

export function useUniverses(): UniversesContextValue {
  const contextValue = useContext(UniversesContext);
  if (contextValue === null) {
    throw new Error("useUniverses must be used inside UniversesProvider");
  }
  return contextValue;
}

/** How the creation request failed, as the message code the form shows; field errors show none. */
function noticeCodeOfFailure(outcome: Exclude<CreationOutcome, { status: "created" }>): CreationNoticeCode | null {
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

/** Runs the call and settles, without a time limit, with how it ended; it never rejects. */
function settleActionCall(work: () => Promise<unknown>): Promise<TimeLimitedOutcome<unknown>> {
  return Promise.resolve()
    .then(work)
    .then(
      (value): TimeLimitedOutcome<unknown> => ({ status: "answered", value }),
      (error: unknown): TimeLimitedOutcome<unknown> => ({ status: "rejected", error }),
    );
}
