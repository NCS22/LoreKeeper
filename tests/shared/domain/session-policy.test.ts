import { describe, expect, it } from "vitest";
import {
  SESSION_LIFETIME_IN_SECONDS,
  SESSION_RENEWAL_INTERVAL_IN_SECONDS,
} from "@/shared/domain/session-policy";

describe("session policy", () => {
  it("keeps a session for 30 days, in seconds", () => {
    expect(SESSION_LIFETIME_IN_SECONDS).toBe(2_592_000);
    expect(SESSION_LIFETIME_IN_SECONDS).toBe(30 * 24 * 60 * 60);
  });

  it("renews a session at most once a day, in seconds", () => {
    expect(SESSION_RENEWAL_INTERVAL_IN_SECONDS).toBe(86_400);
    expect(SESSION_RENEWAL_INTERVAL_IN_SECONDS).toBe(24 * 60 * 60);
  });
});
