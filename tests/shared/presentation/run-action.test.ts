import { notFound, redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  BusinessRuleViolationError,
  ExternalProviderError,
  InfrastructureError,
  NotFoundError,
} from "@/shared/domain/error-kinds";
import { ValidationError } from "@/shared/domain/validation-error";
import { logServerError } from "@/shared/infrastructure/server-error-logger";
import { mapErrorToResponse } from "@/shared/presentation/map-error-to-response";
import { runAction } from "@/shared/presentation/run-action";

vi.mock("@/shared/infrastructure/server-error-logger", () => ({ logServerError: vi.fn() }));

beforeEach(() => {
  vi.mocked(logServerError).mockClear();
});

describe("runAction", () => {
  it("returns the value of the work in the success shape", async () => {
    const result = await runAction(async () => ({ status: "signed-up" }));

    expect(result).toEqual({ ok: true, value: { status: "signed-up" } });
  });

  it("returns a null value as a success too", async () => {
    expect(await runAction(async () => null)).toEqual({ ok: true, value: null });
  });

  const failures = [
    new ValidationError([{ field: "email", code: "INVALID" }]),
    new AuthenticationError("x"),
    new NotFoundError("x"),
    new BusinessRuleViolationError("x"),
    new InfrastructureError("x"),
    new ExternalProviderError("x"),
    new Error("unexpected"),
  ];

  it.each(failures)("builds the failure of %s with the same mapper as everyone else", async (failure) => {
    const result = await runAction(async () => {
      throw failure;
    });

    expect(result).toEqual({ ok: false, error: mapErrorToResponse(failure).body });
  });

  it("gives every failure the same shape: ok false and an error with code and message", async () => {
    for (const failure of failures) {
      const result = await runAction(async () => {
        throw failure;
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(Object.keys(result).sort()).toEqual(["error", "ok"]);
        expect(typeof result.error.code).toBe("string");
        expect(typeof result.error.message).toBe("string");
      }
    }
  });

  it("maps an error thrown synchronously inside the work", async () => {
    const result = await runAction(() => {
      throw new AuthenticationError("x");
    });

    expect(result).toMatchObject({ ok: false, error: { code: "AUTHENTICATION_ERROR" } });
  });

  it("logs an unexpected error and does not leak it", async () => {
    const result = await runAction(async () => {
      throw new Error("secret detail");
    });

    expect(logServerError).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("secret detail");
  });

  describe("framework control-flow errors", () => {
    it("rethrows a redirect", async () => {
      await expect(
        runAction(async () => {
          redirect("/somewhere");
        }),
      ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    });

    it("rethrows a not found", async () => {
      await expect(
        runAction(async () => {
          notFound();
        }),
      ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") });
    });

    it("does not log or map a rethrown error", async () => {
      await runAction(async () => {
        redirect("/somewhere");
      }).catch(() => undefined);

      expect(logServerError).not.toHaveBeenCalled();
    });
  });
});
