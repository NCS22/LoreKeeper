import { describe, expect, it } from "vitest";
import type { TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";
import { decideAfterAccountProbe } from "@/components/universes/account-guard-decision";
import { SIGNED_OUT_ACTION_REFUSAL } from "@/shared/presentation/signed-out-action-response";

const HELD_ACCOUNT_KEY = "account-held-by-this-tab";

function answeredWithAccount(accountKey: unknown): TimeLimitedOutcome<unknown> {
  return { status: "answered", value: { ok: true, value: { accountKey } } };
}

function answeredWithFailure(code: string): TimeLimitedOutcome<unknown> {
  return { status: "answered", value: { ok: false, error: { code, message: "A message." } } };
}

describe("decideAfterAccountProbe", () => {
  it("goes ahead when the server names the account the tab shows", () => {
    expect(decideAfterAccountProbe(HELD_ACCOUNT_KEY, answeredWithAccount(HELD_ACCOUNT_KEY))).toBe("proceed");
  });

  it("starts again, sending nothing, when the server names another account", () => {
    expect(decideAfterAccountProbe(HELD_ACCOUNT_KEY, answeredWithAccount("another-account"))).toBe(
      "replace-document",
    );
  });

  it.each([
    ["the authentication error", answeredWithFailure("AUTHENTICATION_ERROR")],
    ["the refusal of the page guard", { status: "rejected", error: new Error(SIGNED_OUT_ACTION_REFUSAL.text) } as const],
  ])("treats %s as signed out", (_description, outcome) => {
    expect(decideAfterAccountProbe(HELD_ACCOUNT_KEY, outcome)).toBe("signed-out");
  });

  it.each([
    ["no answer in time", { status: "timed-out" } as const],
    ["a lost connection", { status: "rejected", error: new Error("Failed to fetch") } as const],
    ["an infrastructure failure", answeredWithFailure("INFRASTRUCTURE_ERROR")],
    ["an answer that is not an object", { status: "answered", value: "ok" } as const],
    ["an answer without an account key", answeredWithAccount(undefined)],
    ["an account key that is not text", answeredWithAccount(42)],
  ])("goes ahead on %s, because the real call fails by itself", (_description, outcome) => {
    expect(decideAfterAccountProbe(HELD_ACCOUNT_KEY, outcome)).toBe("proceed");
  });
});
