// The decision logic of the live duplicate-name warning (specs/004-stored-universes/plan.md, D10;
// FR-21, FR-22), kept apart from the form so it can be tested without a browser.

/** How long the person must stop typing before the name is checked on the server (D10). */
export const NAME_CHECK_PAUSE_MILLISECONDS = 250;

/** What the server said about one name. */
export type NameCheckAnswer = {
  readonly checkedName: string;
  readonly isInUse: boolean;
};

type ScheduleNameCheckParameters = {
  name: string;
  /** Asks the server; it never rejects, a failed check answers `false` (nothing is shown). */
  checkName: (name: string) => Promise<boolean>;
  onAnswer: (answer: NameCheckAnswer) => void;
};

/**
 * Checks the name once the person has stopped typing for 250 ms. Returns the function that cancels it:
 * call it when the name changes again, so the pending check never runs and an answer that arrives
 * afterwards is ignored. Nothing is asked for an empty name, which no universe can have.
 */
export function scheduleNameCheck({ name, checkName, onAnswer }: ScheduleNameCheckParameters): () => void {
  let isCancelled = false;
  if (name.length === 0) return () => undefined;

  const pauseTimerId = setTimeout(() => {
    void checkName(name).then((isInUse) => {
      if (!isCancelled) onAnswer({ checkedName: name, isInUse });
    });
  }, NAME_CHECK_PAUSE_MILLISECONDS);

  return () => {
    isCancelled = true;
    clearTimeout(pauseTimerId);
  };
}

/** The warning shows only for an answer about the name in the field right now, never for an older one. */
export function isDuplicateNameWarningShown(answer: NameCheckAnswer | null, currentName: string): boolean {
  return answer !== null && answer.isInUse && answer.checkedName === currentName;
}
