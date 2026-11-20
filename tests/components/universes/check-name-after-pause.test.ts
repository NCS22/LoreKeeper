import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NAME_CHECK_PAUSE_MILLISECONDS,
  isDuplicateNameWarningShown,
  scheduleNameCheck,
  type NameCheckAnswer,
} from "@/components/universes/check-name-after-pause";

function createDeferredCheck() {
  let answerCheck: (isInUse: boolean) => void = () => undefined;
  const checkName = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        answerCheck = resolve;
      }),
  );
  return { checkName, answerCheck: (isInUse: boolean) => answerCheck(isInUse) };
}

describe("scheduleNameCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks nothing before the person has paused for 250 ms", async () => {
    const checkName = vi.fn().mockResolvedValue(true);

    scheduleNameCheck({ name: "Ember", checkName, onAnswer: vi.fn() });
    await vi.advanceTimersByTimeAsync(NAME_CHECK_PAUSE_MILLISECONDS - 1);

    expect(NAME_CHECK_PAUSE_MILLISECONDS).toBe(250);
    expect(checkName).not.toHaveBeenCalled();
  });

  it("asks once after the pause and reports the answer with the name it belongs to", async () => {
    const checkName = vi.fn().mockResolvedValue(true);
    const onAnswer = vi.fn<(answer: NameCheckAnswer) => void>();

    scheduleNameCheck({ name: "Ember", checkName, onAnswer });
    await vi.advanceTimersByTimeAsync(NAME_CHECK_PAUSE_MILLISECONDS);

    expect(checkName).toHaveBeenCalledExactlyOnceWith("Ember");
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith({ checkedName: "Ember", isInUse: true });
  });

  it("never asks about a name that changed before the pause ended", async () => {
    const checkName = vi.fn().mockResolvedValue(false);
    const cancelFirstCheck = scheduleNameCheck({ name: "Em", checkName, onAnswer: vi.fn() });

    await vi.advanceTimersByTimeAsync(NAME_CHECK_PAUSE_MILLISECONDS - 50);
    cancelFirstCheck();
    scheduleNameCheck({ name: "Ember", checkName, onAnswer: vi.fn() });
    await vi.advanceTimersByTimeAsync(NAME_CHECK_PAUSE_MILLISECONDS);

    expect(checkName).toHaveBeenCalledExactlyOnceWith("Ember");
  });

  it("ignores an answer that arrives after the name changed again", async () => {
    const slowCheck = createDeferredCheck();
    const onAnswer = vi.fn<(answer: NameCheckAnswer) => void>();
    const cancelCheck = scheduleNameCheck({ name: "Ember", checkName: slowCheck.checkName, onAnswer });

    await vi.advanceTimersByTimeAsync(NAME_CHECK_PAUSE_MILLISECONDS);
    cancelCheck();
    slowCheck.answerCheck(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(slowCheck.checkName).toHaveBeenCalledOnce();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("asks nothing for an empty name", async () => {
    const checkName = vi.fn().mockResolvedValue(true);

    scheduleNameCheck({ name: "", checkName, onAnswer: vi.fn() });
    await vi.advanceTimersByTimeAsync(NAME_CHECK_PAUSE_MILLISECONDS * 4);

    expect(checkName).not.toHaveBeenCalled();
  });
});

describe("isDuplicateNameWarningShown", () => {
  it("shows the warning when the server found the name that is in the field", () => {
    expect(isDuplicateNameWarningShown({ checkedName: "Ember", isInUse: true }, "Ember")).toBe(true);
  });

  it("shows nothing when the name is free", () => {
    expect(isDuplicateNameWarningShown({ checkedName: "Ember", isInUse: false }, "Ember")).toBe(false);
  });

  it("shows nothing for an answer about an earlier name", () => {
    expect(isDuplicateNameWarningShown({ checkedName: "Ember", isInUse: true }, "Ember Concordat")).toBe(false);
  });

  it("shows nothing before any answer", () => {
    expect(isDuplicateNameWarningShown(null, "Ember")).toBe(false);
  });
});
