import { describe, expect, it } from "vitest";
import { interpretSessionConfirmation } from "@/components/accounts/interpret-session-confirmation";
import type { TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";
import {
  AUTHENTICATION_ERROR_CODE,
  INFRASTRUCTURE_ERROR_CODE,
} from "@/shared/domain/error-kinds";

function answered(value: unknown): TimeLimitedOutcome<unknown> {
  return { status: "answered", value };
}

describe("interpretSessionConfirmation", () => {
  it("reads a successful confirmation as session kept", () => {
    expect(interpretSessionConfirmation(answered({ ok: true, value: null }))).toBe("session-kept");
  });

  it("reads an explicit authentication error as session not kept (FR-14)", () => {
    const authenticationFailure = answered({
      ok: false,
      error: { code: AUTHENTICATION_ERROR_CODE, message: "ignored" },
    });

    expect(interpretSessionConfirmation(authenticationFailure)).toBe("session-not-kept");
  });

  it.each([
    ["an infrastructure error", answered({ ok: false, error: { code: INFRASTRUCTURE_ERROR_CODE } })],
    ["a failure without a body", answered({ ok: false })],
    ["a failure with a malformed body", answered({ ok: false, error: "AUTHENTICATION_ERROR" })],
    ["an answer that is not an object", answered("nope")],
    ["no answer at all", answered(undefined)],
    ["silence for 30 seconds", { status: "timed-out" } as const],
    ["a thrown error", { status: "rejected", error: new Error("network") } as const],
  ])("proceeds on %s", (_description, confirmationOutcome) => {
    expect(interpretSessionConfirmation(confirmationOutcome)).toBe("session-kept");
  });
});
