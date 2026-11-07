import { describe, expect, it, vi } from "vitest";
import { requireActingUser } from "@/shared/application/require-acting-user";
import type { SessionReader } from "@/shared/application/session-reader";
import { AuthenticationError, InfrastructureError } from "@/shared/domain/error-kinds";

function createSessionReaderWithSessionOf(userId: string): SessionReader {
  return { readActiveSession: async () => ({ userId }) };
}

const sessionReaderWithoutSession: SessionReader = { readActiveSession: async () => null };

describe("requireActingUser", () => {
  it("returns the account of the valid session as the acting user", async () => {
    const actingUser = await requireActingUser({
      sessionReader: createSessionReaderWithSessionOf("user-of-the-session"),
    });

    expect(actingUser).toEqual({ userId: "user-of-the-session" });
  });

  it("fails with an authentication error when there is no valid session", async () => {
    await expect(requireActingUser({ sessionReader: sessionReaderWithoutSession })).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it("does not run the operation that depends on the acting user when there is no session", async () => {
    const dependentOperation = vi.fn();

    const runOperation = async () => {
      const actingUser = await requireActingUser({ sessionReader: sessionReaderWithoutSession });
      dependentOperation(actingUser);
    };

    await expect(runOperation()).rejects.toBeInstanceOf(AuthenticationError);
    expect(dependentOperation).not.toHaveBeenCalled();
  });

  it("lets the infrastructure failure of the reader through, as itself", async () => {
    const readerFailure = new InfrastructureError("The session could not be checked.");
    const failingSessionReader: SessionReader = {
      readActiveSession: async () => {
        throw readerFailure;
      },
    };

    const failure = await requireActingUser({ sessionReader: failingSessionReader }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBe(readerFailure);
    expect(failure).toBeInstanceOf(InfrastructureError);
    expect(failure).not.toBeInstanceOf(AuthenticationError);
  });

  it("does not treat a failure of the reader as a signed-out request", async () => {
    const failingSessionReader: SessionReader = {
      readActiveSession: async () => {
        throw new InfrastructureError("The session could not be checked.");
      },
    };

    await expect(requireActingUser({ sessionReader: failingSessionReader })).rejects.not.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it("ignores an identifier of another account that travels with the request", async () => {
    // The check takes no request data: whatever else the caller holds cannot reach it.
    const requestLikeObject = {
      sessionReader: createSessionReaderWithSessionOf("user-of-the-session"),
      userId: "another-account",
      headers: { "x-user-id": "another-account" },
      body: { userId: "another-account" },
    };

    const actingUser = await requireActingUser(requestLikeObject);

    expect(actingUser).toEqual({ userId: "user-of-the-session" });
  });

  it("gives the reader no argument to choose a session with", async () => {
    const readActiveSession = vi.fn(async () => ({ userId: "user-of-the-session" }));

    await requireActingUser({ sessionReader: { readActiveSession } });

    expect(readActiveSession).toHaveBeenCalledWith();
  });
});
