import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  runWithTimeLimit,
  SUBMISSION_TIME_LIMIT_MILLISECONDS,
} from "@/components/accounts/run-with-time-limit";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runWithTimeLimit", () => {
  it("uses the 30 second limit of FR-11", () => {
    expect(SUBMISSION_TIME_LIMIT_MILLISECONDS).toBe(30_000);
  });

  it("gives the answer when it arrives before the limit", async () => {
    const outcomePromise = runWithTimeLimit(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("done"), 29_999)),
    );

    await vi.advanceTimersByTimeAsync(29_999);

    expect(await outcomePromise).toEqual({ status: "answered", value: "done" });
  });

  it("gives an answer that is available at once", async () => {
    const outcomePromise = runWithTimeLimit(() => Promise.resolve(42));

    expect(await outcomePromise).toEqual({ status: "answered", value: 42 });
  });

  it("gives up in silence when nothing arrives within 30 seconds", async () => {
    const outcomePromise = runWithTimeLimit(() => new Promise<string>(() => undefined));

    await vi.advanceTimersByTimeAsync(SUBMISSION_TIME_LIMIT_MILLISECONDS - 1);
    let hasSettledEarly = false;
    void outcomePromise.then(() => {
      hasSettledEarly = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(hasSettledEarly).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    expect(await outcomePromise).toEqual({ status: "timed-out" });
  });

  it("reports a rejection with its error", async () => {
    const connectionLost = new TypeError("Failed to fetch");

    const outcome = await runWithTimeLimit(() => Promise.reject(connectionLost));

    expect(outcome).toEqual({ status: "rejected", error: connectionLost });
  });

  it("reports a work function that throws before returning a promise as a rejection", async () => {
    const failure = new Error("broken");

    const outcome = await runWithTimeLimit(() => {
      throw failure;
    });

    expect(outcome).toEqual({ status: "rejected", error: failure });
  });

  it("ignores a late answer after the limit", async () => {
    let answerLate: (value: string) => void = () => undefined;
    const outcomePromise = runWithTimeLimit(
      () => new Promise<string>((resolve) => (answerLate = resolve)),
    );
    await vi.advanceTimersByTimeAsync(SUBMISSION_TIME_LIMIT_MILLISECONDS);
    const outcome = await outcomePromise;

    answerLate("too late");
    await vi.advanceTimersByTimeAsync(0);

    expect(outcome).toEqual({ status: "timed-out" });
  });

  it("ignores a late rejection after the limit without leaving it unhandled", async () => {
    let failLate: (error: unknown) => void = () => undefined;
    const outcomePromise = runWithTimeLimit(
      () => new Promise<string>((_resolve, reject) => (failLate = reject)),
    );
    await vi.advanceTimersByTimeAsync(SUBMISSION_TIME_LIMIT_MILLISECONDS);
    const outcome = await outcomePromise;

    failLate(new Error("too late"));
    await vi.advanceTimersByTimeAsync(0);

    expect(outcome).toEqual({ status: "timed-out" });
  });

  it("clears its timer once the answer arrived", async () => {
    await runWithTimeLimit(() => Promise.resolve("done"));

    expect(vi.getTimerCount()).toBe(0);
  });

  it("accepts a limit of its own", async () => {
    const outcomePromise = runWithTimeLimit(() => new Promise<string>(() => undefined), 500);

    await vi.advanceTimersByTimeAsync(500);

    expect(await outcomePromise).toEqual({ status: "timed-out" });
  });
});
