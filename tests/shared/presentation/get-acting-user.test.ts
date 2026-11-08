import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveSession } from "@/shared/application/session-reader";
import { AuthenticationError, InfrastructureError } from "@/shared/domain/error-kinds";
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

  it("fails with an authentication error when the request has no valid session (FR-20)", async () => {
    readActiveSession.mockResolvedValue(null);

    await expect(getActingUser()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("fails with an infrastructure error, not an authentication error, when the session cannot be checked (FR-22)", async () => {
    readActiveSession.mockRejectedValue(new InfrastructureError("The session could not be checked."));

    const failure = await getActingUser().then(
      () => undefined,
      (reason: unknown) => reason,
    );

    expect(failure).toBeInstanceOf(InfrastructureError);
    expect(failure).not.toBeInstanceOf(AuthenticationError);
  });

  it("takes no input, so nothing the client sends can choose the account (FR-21)", () => {
    expect(getActingUser.length).toBe(0);
  });
});
