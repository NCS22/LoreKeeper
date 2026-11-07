import { afterEach, describe, expect, it, vi } from "vitest";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import { logServerError } from "@/shared/infrastructure/server-error-logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logServerError", () => {
  it("writes the error itself, with its cause, and the code it was answered with", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const cause = new Error("connection refused");
    const error = new InfrastructureError("Database unavailable", { cause });

    logServerError(error, { errorCode: "INFRASTRUCTURE_ERROR" });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const [label, loggedError] = consoleSpy.mock.calls[0] ?? [];
    expect(label).toContain("INFRASTRUCTURE_ERROR");
    expect(loggedError).toBe(error);
    expect(loggedError).toHaveProperty("cause", cause);
  });

  it("logs a value that is not an Error as it was thrown", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logServerError("plain text failure", { errorCode: "UNKNOWN_ERROR" });

    expect(consoleSpy.mock.calls[0]?.[1]).toBe("plain text failure");
  });

  it("does not accept a password, a body or any other detail in the context", () => {
    // The three calls below are rejected by the compiler (`pnpm typecheck` checks the directives).
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("x");

    // @ts-expect-error the context has no room for a password
    logServerError(error, { errorCode: "UNKNOWN_ERROR", password: "typed-password" });
    // @ts-expect-error the context has no room for a request body
    logServerError(error, { errorCode: "UNKNOWN_ERROR", body: { email: "ana@example.com" } });
    // @ts-expect-error the code of the failure is required
    logServerError(error, {});

    expect(consoleSpy).toHaveBeenCalledTimes(3);
  });
});
