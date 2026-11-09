/** FR-11: an answer that has not arrived after this long counts as no usable answer. */
export const SUBMISSION_TIME_LIMIT_MILLISECONDS = 30_000;

/** How a submission ended, from the point of view of the interface. */
export type TimeLimitedOutcome<Value> =
  | { readonly status: "answered"; readonly value: Value }
  | { readonly status: "timed-out" }
  | { readonly status: "rejected"; readonly error: unknown };

/**
 * Runs the work and settles with whichever comes first: its answer, its failure, or the end of the
 * time limit. Server Actions cannot be aborted, so after the limit the work keeps running but its
 * late answer, or late failure, is ignored (plan D16).
 */
export function runWithTimeLimit<Value>(
  work: () => Promise<Value>,
  limitInMilliseconds: number = SUBMISSION_TIME_LIMIT_MILLISECONDS,
): Promise<TimeLimitedOutcome<Value>> {
  return new Promise((settle) => {
    let hasSettled = false;

    function settleOnce(outcome: TimeLimitedOutcome<Value>): void {
      if (hasSettled) return;
      hasSettled = true;
      clearTimeout(timerId);
      settle(outcome);
    }

    const timerId = setTimeout(() => settleOnce({ status: "timed-out" }), limitInMilliseconds);

    // `Promise.resolve().then(work)` also turns a synchronous throw of the work into a rejection.
    Promise.resolve()
      .then(work)
      .then(
        (value) => settleOnce({ status: "answered", value }),
        (error: unknown) => settleOnce({ status: "rejected", error }),
      );
  });
}
