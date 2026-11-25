import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveSession } from "@/shared/application/session-reader";
import { getActingUser } from "@/shared/presentation/get-acting-user";

const { readActiveSession } = vi.hoisted(() => ({
  readActiveSession: vi.fn<() => Promise<ActiveSession | null>>(),
}));

// The reader bound to the request is replaced: this test is about the wiring of the check to it.
vi.mock("@/shared/infrastructure/request-session-reader", () => ({
  requestSessionReader: { readActiveSession },
}));

describe("getActingUser", () => {
  beforeEach(() => {
    readActiveSession.mockReset();
  });

  it("returns the account of the session of the request (FR-20)", async () => {
    readActiveSession.mockResolvedValue({
      userId: "user-of-the-session",
      displayName: "Ana Torres",
      email: "ana@example.com",
    });

    expect(await getActingUser()).toEqual({
      userId: "user-of-the-session",
      displayName: "Ana Torres",
      email: "ana@example.com",
    });
  });

  it("takes no input, so nothing the client sends can choose the account (FR-21)", () => {
    expect(getActingUser.length).toBe(0);
  });
});
