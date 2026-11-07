import { describe, expect, it, vi } from "vitest";
import { getBetterAuthInstance } from "@/shared/infrastructure/better-auth-instance";
import {
  readCurrentRequestHeaders,
  requestSessionReader,
} from "@/shared/infrastructure/request-session-reader";
import {
  TEST_SESSION_COOKIE_NAME,
  prepareRealCompositionOverTestDatabase,
} from "../../support/database/real-composition-environment";
import { emulatedBrowser, setEmulatedRequestHeader } from "../../support/emulated-next-headers";

vi.mock("next/headers", async () =>
  (await import("../../support/emulated-next-headers")).nextHeadersModuleReplacement,
);

prepareRealCompositionOverTestDatabase();

/** Signs an account up with the application's own library instance, which leaves the session cookie in the emulated browser. */
async function signUpThroughTheApplicationInstance(email: string): Promise<string> {
  const { user } = await getBetterAuthInstance().api.signUpEmail({
    body: { name: "Ana Torres", email, password: "correct horse" },
  });
  return user.id;
}

describe("readCurrentRequestHeaders", () => {
  it("gives the headers of the request being served, with the session cookie the browser holds", async () => {
    emulatedBrowser.holdCookie(TEST_SESSION_COOKIE_NAME, "token-held-by-the-browser");
    setEmulatedRequestHeader("host", "localhost:3000");

    const requestHeaders = await readCurrentRequestHeaders();

    expect(requestHeaders.get("cookie")).toBe(`${TEST_SESSION_COOKIE_NAME}=token-held-by-the-browser`);
    expect(requestHeaders.get("host")).toBe("localhost:3000");
  });

  it("gives no cookie header when the browser holds no cookie", async () => {
    expect((await readCurrentRequestHeaders()).get("cookie")).toBeNull();
  });
});

describe("requestSessionReader", () => {
  it("reads the account of the session cookie of the current request, through the real composition (FR-20)", async () => {
    const signedUpUserId = await signUpThroughTheApplicationInstance("ana@example.com");

    expect(await requestSessionReader.readActiveSession()).toEqual({ userId: signedUpUserId });
  });

  it("reads no session when the current request carries no session cookie (FR-26)", async () => {
    await signUpThroughTheApplicationInstance("ana@example.com");
    emulatedBrowser.clear();

    expect(await requestSessionReader.readActiveSession()).toBeNull();
  });

  it("follows the request being served: the same reader reads the account of whichever device sends the request (FR-21)", async () => {
    const firstUserId = await signUpThroughTheApplicationInstance("ana@example.com");
    const firstDeviceCookie = emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME);
    emulatedBrowser.clear();
    const secondUserId = await signUpThroughTheApplicationInstance("lia@example.com");

    expect(await requestSessionReader.readActiveSession()).toEqual({ userId: secondUserId });

    emulatedBrowser.holdCookie(TEST_SESSION_COOKIE_NAME, firstDeviceCookie ?? "");
    expect(await requestSessionReader.readActiveSession()).toEqual({ userId: firstUserId });
  });
});
