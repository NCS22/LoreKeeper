import { describe, expect, it, vi } from "vitest";
import { requireActingUser } from "@/shared/application/require-acting-user";
import type { SessionReader } from "@/shared/application/session-reader";
import { AuthenticationError, InfrastructureError } from "@/shared/domain/error-kinds";

const SESSION_DISPLAY_NAME = "Ana Torres";
const SESSION_EMAIL = "ana@example.com";

function createSessionReaderWithSessionOf(userId: string): SessionReader {
  return {
    readActiveSession: async () => ({ userId, displayName: SESSION_DISPLAY_NAME, email: SESSION_EMAIL }),
  };
}

const expectedActingUser = {
  userId: "user-of-the-session",
  displayName: SESSION_DISPLAY_NAME,
  email: SESSION_EMAIL,
};

const sessionReaderWithoutSession: SessionReader = { readActiveSession: async () => null };

describe("requireActingUser", () => {
  it("returns the account of the valid session as the acting user", async () => {
    const actingUser = await requireActingUser({
      sessionReader: createSessionReaderWithSessionOf("user-of-the-session"),
    });

    expect(actingUser).toEqual(expectedActingUser);
  });

  it("holds exactly the identifier, the display name and the email, so nothing else of the session passes through", async () => {
    const sessionReaderWithExtraFields = {
      readActiveSession: async () => ({
        userId: "user-of-the-session",
        displayName: SESSION_DISPLAY_NAME,
        email: SESSION_EMAIL,
        password: "typed password",
        passwordHash: "hash",
        sessionToken: "token",
        isAdministrator: true,
      }),
    } satisfies SessionReader;

    const actingUser = await requireActingUser({ sessionReader: sessionReaderWithExtraFields });

    expect(actingUser).toStrictEqual(expectedActingUser);
    expect(Object.keys(actingUser).sort()).toEqual(["displayName", "email", "userId"]);
  });

  it("gives the same values on two checks in a row", async () => {
    const dependencies = { sessionReader: createSessionReaderWithSessionOf("user-of-the-session") };

    const firstActingUser = await requireActingUser(dependencies);
    const secondActingUser = await requireActingUser(dependencies);

    expect(secondActingUser).toEqual(firstActingUser);
    expect(firstActingUser).toEqual(expectedActingUser);
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
    expect((failure as InfrastructureError).message).toBe("The session could not be checked.");
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

  it("fails without details when there is no session", async () => {
    const failure = await requireActingUser({ sessionReader: sessionReaderWithoutSession }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(AuthenticationError);
    expect((failure as AuthenticationError).message).toBe("There is no valid session.");
    expect(failure).not.toHaveProperty("cause");
  });

  it("ignores an identifier of another account that travels with the request", async () => {
    // The check takes no request data: whatever else the caller holds cannot reach it.
    const requestLikeObject = {
      sessionReader: createSessionReaderWithSessionOf("user-of-the-session"),
      userId: "another-account",
      displayName: "Another Account",
      email: "another@example.com",
      headers: { "x-user-id": "another-account", "x-user-email": "another@example.com" },
      body: { userId: "another-account", displayName: "Another Account", email: "another@example.com" },
    };

    const actingUser = await requireActingUser(requestLikeObject);

    expect(actingUser).toEqual(expectedActingUser);
  });

  it("gives the reader no argument to choose a session with", async () => {
    const readActiveSession = vi.fn(async () => expectedActingUser);

    await requireActingUser({ sessionReader: { readActiveSession } });

    expect(readActiveSession).toHaveBeenCalledWith();
  });
});
