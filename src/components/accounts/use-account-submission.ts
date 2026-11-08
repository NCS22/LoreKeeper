"use client";

import { useCallback, useRef, useState } from "react";
import { runWithTimeLimit, type TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";

export type AccountSubmission = {
  /** True from the start of a submission until `releaseSubmission` is called; drives the disabled control and `aria-busy`. */
  readonly isSubmitting: boolean;
  /**
   * Starts the work under the time limit and resolves with how it ended. Resolves with `null`
   * without calling the work when a submission is already waiting, however the repeat was made
   * (second click, repeated Enter or both). The submission stays in progress until it is released.
   */
  readonly runSubmission: <Value>(work: () => Promise<Value>) => Promise<TimeLimitedOutcome<Value> | null>;
  /** Makes the form usable again. Not called after a success: the page is about to be left. */
  readonly releaseSubmission: () => void;
};

/**
 * The waiting state shared by the sign-up form, the sign-in form and the sign-out control (FR-11,
 * FR-12, NFR-5). A reference blocks the repeat at once because a state update arrives only after
 * the next event could already have run.
 */
export function useAccountSubmission(): AccountSubmission {
  const isSubmissionInFlightRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const runSubmission = useCallback(
    async <Value>(work: () => Promise<Value>): Promise<TimeLimitedOutcome<Value> | null> => {
      if (isSubmissionInFlightRef.current) return null;
      isSubmissionInFlightRef.current = true;
      setIsSubmitting(true);
      return runWithTimeLimit(work);
    },
    [],
  );

  const releaseSubmission = useCallback(() => {
    isSubmissionInFlightRef.current = false;
    setIsSubmitting(false);
  }, []);

  return { isSubmitting, runSubmission, releaseSubmission };
}
