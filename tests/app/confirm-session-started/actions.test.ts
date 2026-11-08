import { describe, expect, it, vi } from "vitest";
import { confirmSessionStartedAction } from "@/app/confirm-session-started/actions";
import { createAccountsModule } from "@/modules/accounts";
import { AUTHENTICATION_ERROR_CODE } from "@/shared/domain/error-kinds";
import { VALIDATION_ERROR_CODE } from "@/shared/domain/validation-error";
import { CROSS_SITE_REQUEST_ISSUE_CODE } from "@/shared/presentation/assert-same-site-request";
import { ERROR_MESSAGE_BY_CODE } from "@/shared/presentation/error-messages";
import {
  CROSS_SITE_REQUEST_EMULATIONS,
  TEST_SESSION_COOKIE_NAME,
  emulateRequestFromThisSite,
  prepareRealCompositionOverTestDatabase,
} from "../../support/database/real-composition-environment";
import { emulatedBrowser } from "../../support/emulated-next-headers";

vi.mock("next/headers", async () =>
  (await import("../../support/emulated-next-headers")).nextHeadersModuleReplacement,
);

const PASSWORD = "unique-typed-password-4f9c1a";

const { readStoredRowsClient } = prepareRealCompositionOverTestDatabase();

async function signUpAnaThroughTheUseCase(): Promise<void> {
  await createAccountsModule().signUp({
    displayName: "Ana Torres",
    email: "ana@example.com",
    password: PASSWORD,
    repeatPassword: PASSWORD,
  });
}

describe("confirmSessionStartedAction", () => {
  it("answers ok with null when the request carries a valid session (FR-14)", async () => {
    await signUpAnaThroughTheUseCase();

    const result = await confirmSessionStartedAction();

    expect(result).toEqual({ ok: true, value: null });
  });

  it("accepts a request from a page of the application itself", async () => {
    await signUpAnaThroughTheUseCase();
    emulateRequestFromThisSite();

    const result = await confirmSessionStartedAction();

    expect(result).toEqual({ ok: true, value: null });
  });

  it("only reads: the session and its cookie are left as they were", async () => {
    await signUpAnaThroughTheUseCase();
    const sessionTokenBefore = emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME);
    const storedSessionsBefore = await readStoredRowsClient().session.findMany();

    await confirmSessionStartedAction();

    expect(emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME)).toBe(sessionTokenBefore);
    expect(await readStoredRowsClient().session.findMany()).toEqual(storedSessionsBefore);
  });

  it("answers the authentication error when the browser holds no session (FR-14)", async () => {
    const result = await confirmSessionStartedAction();

    expect(result).toEqual({
      ok: false,
      error: {
        code: AUTHENTICATION_ERROR_CODE,
        message: ERROR_MESSAGE_BY_CODE[AUTHENTICATION_ERROR_CODE],
      },
    });
  });

  it("answers the authentication error when the session cookie is not a stored session", async () => {
    emulatedBrowser.holdCookie(TEST_SESSION_COOKIE_NAME, "not-a-real-session-token");

    const result = await confirmSessionStartedAction();

    expect(result).toMatchObject({ ok: false, error: { code: AUTHENTICATION_ERROR_CODE } });
  });

  it.each(CROSS_SITE_REQUEST_EMULATIONS)(
    "rejects a request with $label, even with a valid session",
    async ({ emulate }) => {
      await signUpAnaThroughTheUseCase();
      emulate();

      const result = await confirmSessionStartedAction();

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: VALIDATION_ERROR_CODE,
          fieldErrors: { request: [{ code: CROSS_SITE_REQUEST_ISSUE_CODE }] },
        },
      });
    },
  );
});
