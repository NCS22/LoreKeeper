import { afterEach, describe, expect, it, vi } from "vitest";
import { logServerError } from "@/shared/infrastructure/server-error-logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logServerError", () => {
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
