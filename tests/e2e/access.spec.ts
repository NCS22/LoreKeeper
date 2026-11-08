import { expect as baseExpect, test, type APIResponse, type Page } from "@playwright/test";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { en } from "../../src/messages/en";
import { findSessionCookieValue } from "./support/account-form-support";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import type { E2eAccount } from "./support/unique-account";
import { waitForFormHydration } from "./support/wait-for-form-hydration";

// Access to pages (FR-13, FR-15, FR-18 to FR-22, FR-29, FR-34, NFR-4): what a signed-out client gets
// from every kind of request, what a signed-in person gets from the sign pages, the three public
// resources, and the browser protections and `no-store` that the browser receives.

// Sign-in runs a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

const HEALTHY_SERVER_ADDRESS = "http://localhost:3100";
const SAMPLE_UNIVERSE_NAME = "The Ember Concordat";
// Text that only a signed-in person sees in the workspace root: the sample universes and the labels
// of the top bar, the side panels and the center (NFR-4). None of it may reach a signed-out client.
const WORKSPACE_ONLY_TEXTS = [
  SAMPLE_UNIVERSE_NAME,
  "Tidewrack",
  en.workspace.mainLabel,
  en.workspace.sidebarLabel,
  en.workspace.inspectorLabel,
  en.sidebar.treeLabel,
  en.sidebar.newUniverse,
  en.center.graphView,
  en.center.newElement,
  en.menus.label,
];
// A call to a Server Action carries this header; its value is the identifier of an action.
const OPERATION_CALL_HEADERS = { "next-action": "0123456789abcdef", "content-type": "text/plain;charset=UTF-8" };
const SIGN_IN_MESSAGES = en.accountForms.signIn;

type RequestedMethod = "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "PATCH";

function expectNoWorkspaceText(response: APIResponse, body: string): void {
  const headersText = JSON.stringify(response.headers());
  for (const workspaceText of WORKSPACE_ONLY_TEXTS) {
    expect(body, `body contains "${workspaceText}"`).not.toContain(workspaceText);
    expect(headersText, `headers contain "${workspaceText}"`).not.toContain(workspaceText);
  }
}

async function signInThroughTheForm(page: Page, account: E2eAccount, signInAddress = "/sign-in"): Promise<void> {
  await page.goto(signInAddress);
  await waitForFormHydration(page);
  await page.getByLabel(SIGN_IN_MESSAGES.emailLabel).fill(account.email);
  await page.getByLabel(SIGN_IN_MESSAGES.passwordLabel).fill(account.password);
  await page.getByRole("button", { name: SIGN_IN_MESSAGES.submit, exact: true }).click();
}

async function expectWorkspaceIsShown(page: Page): Promise<void> {
  await expect(page.getByText(SAMPLE_UNIVERSE_NAME).first()).toBeVisible();
}

test.describe("a signed-out client asking for a page", () => {
  const redirectedRequests: ReadonlyArray<{
    name: string;
    method: RequestedMethod;
    address: string;
    extraHeaders?: Record<string, string>;
    expectedLocation: string;
  }> = [
    { name: "GET /", method: "GET", address: "/", expectedLocation: "/sign-in?returnTo=%2F" },
    { name: "GET /?x=1", method: "GET", address: "/?x=1", expectedLocation: "/sign-in?returnTo=%2F%3Fx%3D1" },
    { name: "GET /nope", method: "GET", address: "/nope", expectedLocation: "/sign-in?returnTo=%2Fnope" },
    {
      name: "a background page request (the framework's _rsc parameter never enters the destination)",
      method: "GET",
      address: "/?x=1&_rsc=abc12",
      extraHeaders: { rsc: "1" },
      expectedLocation: "/sign-in?returnTo=%2F%3Fx%3D1",
    },
    { name: "HEAD /", method: "HEAD", address: "/", expectedLocation: "/sign-in?returnTo=%2F" },
    // A request with a body cannot be replayed after sign-in, so no destination is carried.
    { name: "POST /", method: "POST", address: "/", expectedLocation: "/sign-in" },
    { name: "PUT /nope", method: "PUT", address: "/nope", expectedLocation: "/sign-in" },
    { name: "DELETE /?x=1", method: "DELETE", address: "/?x=1", expectedLocation: "/sign-in" },
  ];

  for (const redirectedRequest of redirectedRequests) {
    test(`gets 303 to sign-in, with no workspace text and no cookie, for ${redirectedRequest.name} (FR-18, FR-21, NFR-4)`, async ({
      request,
    }) => {
      const response = await request.fetch(redirectedRequest.address, {
        method: redirectedRequest.method,
        headers: redirectedRequest.extraHeaders,
        maxRedirects: 0,
      });

      expect(response.status()).toBe(303);
      expect(response.headers()["location"]).toBe(redirectedRequest.expectedLocation);
      expect(response.headers()["cache-control"]).toBe("no-store");
      expect(response.headers()["set-cookie"]).toBeUndefined();
      // The framework ends a redirect from the proxy with the address as the body, or with nothing
      // (a HEAD answer): never anything but the address to go to, which is not workspace content.
      const body = await response.text();
      expect(
        body === "" || body === redirectedRequest.expectedLocation,
        `unexpected redirect body: ${body}`,
      ).toBe(true);
      expectNoWorkspaceText(response, body);
    });
  }

  test("a request for an unfinished public-looking address is not served as a public resource", async ({
    request,
  }) => {
    // The exclusion of the public resources stops at a path-segment boundary (decision D-T2-2).
    const response = await request.get("/_next/staticfoo", { maxRedirects: 0 });

    expect(response.status()).toBe(303);
    expect(response.headers()["location"]).toMatch(/^\/sign-in\?returnTo=/);
  });
});

test.describe("a signed-out client making an operation call to a workspace address", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
    for (const address of ["/", "/?x=1", "/nope"]) {
      test(`gets the 401 text, not a redirect, for ${method} ${address} (FR-21 exception, NFR-4)`, async ({
        request,
      }) => {
        const response = await request.fetch(address, {
          method,
          headers: OPERATION_CALL_HEADERS,
          data: "[]",
          maxRedirects: 0,
        });

        expect(response.status()).toBe(401);
        expect(response.headers()["location"]).toBeUndefined();
        expect(response.headers()["content-type"]).toBe("text/plain");
        expect(response.headers()["cache-control"]).toBe("no-store");
        expect(response.headers()["set-cookie"]).toBeUndefined();
        const responseText = await response.text();
        expect(responseText).toBe("Signed out.");
        expectNoWorkspaceText(response, responseText);
      });
    }
  }

  test("does not run a real operation replayed from outside: no session starts and nothing is answered but the refusal", async ({
    page,
    request,
  }) => {
    // Capture a real sign-in call made by the application's own form (a real action identifier and a
    // real body with correct credentials), then replay it to the workspace root without any session.
    const account = await seedAccountInDatabase();
    const signInCallPromise = page.waitForRequest(
      (pageRequest) =>
        pageRequest.method() === "POST" &&
        pageRequest.headers()["next-action"] !== undefined &&
        (pageRequest.postData() ?? "").includes(account.email),
    );
    await signInThroughTheForm(page, account);
    const signInCall = await signInCallPromise;
    await expectWorkspaceIsShown(page);

    const replayedCall = await request.post("/", {
      headers: {
        "next-action": signInCall.headers()["next-action"],
        "content-type": signInCall.headers()["content-type"],
      },
      data: signInCall.postDataBuffer() ?? "",
      maxRedirects: 0,
    });

    expect(replayedCall.status()).toBe(401);
    expect(replayedCall.headers()["set-cookie"]).toBeUndefined();
    expect(replayedCall.headers()["content-type"]).toBe("text/plain");
    const replayedText = await replayedCall.text();
    expect(replayedText).toBe("Signed out.");
    expectNoWorkspaceText(replayedCall, replayedText);
  });
});

test.describe("a signed-out client asking for the public resources", () => {
  test("is not redirected for a real static file, for /_next/image and for /favicon.ico (FR-20, FR-21)", async ({
    page,
    request,
  }) => {
    await page.goto("/sign-in");
    const staticFileAddresses = await page.evaluate(() =>
      [...document.querySelectorAll("script[src], link[href]")]
        .map((element) => element.getAttribute("src") ?? element.getAttribute("href") ?? "")
        .filter((address) => address.startsWith("/_next/static/")),
    );
    expect(staticFileAddresses.length).toBeGreaterThan(0);
    const staticFileAddress = staticFileAddresses[0];
    // The address was read from the loaded page, and it is a real file of this build.
    const builtStaticFiles = await readdir(path.join(process.cwd(), ".next", "static"), { recursive: true });
    expect(builtStaticFiles.map((file) => file.replaceAll("\\", "/"))).toContain(
      decodeURIComponent(staticFileAddress.slice("/_next/static/".length).split("?")[0]),
    );

    const staticFileResponse = await request.get(staticFileAddress, { maxRedirects: 0 });
    expect(staticFileResponse.status()).toBe(200);
    expect(staticFileResponse.headers()["location"]).toBeUndefined();

    const imageResponse = await request.get("/_next/image?url=%2Ffavicon.ico&w=64&q=75", { maxRedirects: 0 });
    expect(imageResponse.status(), "the image endpoint answers by itself, whatever its answer is").not.toBe(303);
    expect(imageResponse.headers()["location"]).toBeUndefined();
    expect(await imageResponse.text()).not.toContain("/sign-in");

    const siteIconResponse = await request.get("/favicon.ico", { maxRedirects: 0 });
    expect(siteIconResponse.status()).toBe(200);
    expect(siteIconResponse.headers()["location"]).toBeUndefined();
  });

  for (const pageAddress of ["/sign-in", "/sign-up"]) {
    test(`loads ${pageAddress} completely in a signed-out browser (FR-18, FR-21)`, async ({ page }) => {
      const failedResponses: string[] = [];
      const pageErrors: string[] = [];
      page.on("response", (response) => {
        if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));

      const response = await page.goto(pageAddress);
      expect(response?.status()).toBe(200);
      await waitForFormHydration(page);
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(pageAddress);
      // Styles and scripts arrived: the design tokens are applied, so the page is not the unstyled document.
      const pageBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(pageBackground).not.toBe("rgba(0, 0, 0, 0)");
      expect(failedResponses).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  }
});

test.describe("the return destination in the browser (FR-13, FR-19, FR-20)", () => {
  test("navigating to /?x=1 signs in and comes back to /?x=1 with its query and no _rsc parameter", async ({
    page,
  }) => {
    const account = await seedAccountInDatabase();

    await page.goto("/?x=1");
    await waitForFormHydration(page);
    expect(new URL(page.url()).pathname).toBe("/sign-in");
    expect(page.url()).toBe(`${HEALTHY_SERVER_ADDRESS}/sign-in?returnTo=%2F%3Fx%3D1`);
    expect(page.url()).not.toContain("_rsc");
    await expect(page.getByRole("heading", { name: SIGN_IN_MESSAGES.title })).toBeVisible();
    await expect(page.getByText(SAMPLE_UNIVERSE_NAME)).toHaveCount(0);

    await page.getByLabel(SIGN_IN_MESSAGES.emailLabel).fill(account.email);
    await page.getByLabel(SIGN_IN_MESSAGES.passwordLabel).fill(account.password);
    await page.getByRole("button", { name: SIGN_IN_MESSAGES.submit, exact: true }).click();

    await expectWorkspaceIsShown(page);
    expect(page.url()).toBe(`${HEALTHY_SERVER_ADDRESS}/?x=1`);
    expect(page.url()).not.toContain("_rsc");
  });

  const ignoredDestinations: ReadonlyArray<{ name: string; returnTo: string }> = [
    { name: "an address of another site", returnTo: encodeURIComponent("https://evil.example/") },
    { name: "an address that reads as another site", returnTo: encodeURIComponent("//evil.example/") },
    { name: "a malformed encoding", returnTo: "%E0%A4%A" },
    { name: "the sign-in page itself", returnTo: encodeURIComponent("/sign-in") },
    { name: "the sign-up page with a query", returnTo: encodeURIComponent("/sign-up?x=1") },
    { name: "a public resource", returnTo: encodeURIComponent("/favicon.ico") },
  ];

  for (const ignoredDestination of ignoredDestinations) {
    test(`ignores ${ignoredDestination.name} and uses the workspace root`, async ({ page }) => {
      const account = await seedAccountInDatabase();

      await signInThroughTheForm(page, account, `/sign-in?returnTo=${ignoredDestination.returnTo}`);

      await expectWorkspaceIsShown(page);
      expect(page.url()).toBe(`${HEALTHY_SERVER_ADDRESS}/`);
    });
  }
});

test.describe("a signed-in person", () => {
  test("is redirected from the sign-in and sign-up pages to the valid destination or to the root (FR-21, FR-22)", async ({
    page,
  }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    await expectWorkspaceIsShown(page);
    expect(await findSessionCookieValue(page)).toBeDefined();

    // Responses, without following the redirect (the browser's cookies travel with this request).
    const expectedRedirects: ReadonlyArray<readonly [string, string]> = [
      ["/sign-in", "/"],
      ["/sign-up", "/"],
      ["/sign-in?returnTo=%2F%3Fx%3D1", "/?x=1"],
      ["/sign-up?returnTo=%2Fa%2Fb%3Fx%3D1%26y%3D2", "/a/b?x=1&y=2"],
      ["/sign-in?returnTo=https%3A%2F%2Fevil.example", "/"],
      ["/sign-up?returnTo=%2Fsign-in", "/"],
      ["/sign-in?returnTo=%E0%A4%A", "/"],
    ];
    for (const [requestedAddress, expectedLocation] of expectedRedirects) {
      const response = await page.request.get(requestedAddress, { maxRedirects: 0 });
      expect(response.status(), requestedAddress).toBe(303);
      expect(response.headers()["location"], requestedAddress).toBe(expectedLocation);
      expect(response.headers()["cache-control"], requestedAddress).toBe("no-store");
    }

    // The same, as a person would see it in the browser.
    await page.goto("/sign-in");
    await expectWorkspaceIsShown(page);
    expect(page.url()).toBe(`${HEALTHY_SERVER_ADDRESS}/`);

    await page.goto("/sign-up?returnTo=%2F%3Fx%3D1");
    await expectWorkspaceIsShown(page);
    expect(page.url()).toBe(`${HEALTHY_SERVER_ADDRESS}/?x=1`);
    expect(await findSessionCookieValue(page)).toBeDefined();
  });

  test("sees the workspace on a page request, which stays signed in after a reload (the way in works)", async ({
    page,
  }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    await expectWorkspaceIsShown(page);
    expect(await findSessionCookieValue(page)).toBeDefined();

    const reloadedResponse = await page.goto("/");
    expect(reloadedResponse?.status()).toBe(200);
    await expectWorkspaceIsShown(page);
  });
});

test.describe("the headers the browser receives", () => {
  const expectedSecurityHeaders = {
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
  };

  for (const signedOutPageAddress of ["/sign-in", "/sign-up"]) {
    test(`${signedOutPageAddress} carries the browser protections (FR-34)`, async ({ page }) => {
      const response = await page.goto(signedOutPageAddress);

      expect(response?.status()).toBe(200);
      expect(response?.headers()).toMatchObject(expectedSecurityHeaders);
    });
  }

  test("the sign-in page also says no-store (FR-29)", async ({ page }) => {
    const response = await page.goto("/sign-in");

    expect(response?.headers()["cache-control"]).toBe("no-store");
  });

  test("the workspace root carries the browser protections and no-store when signed in (FR-34, FR-29)", async ({
    page,
  }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    await expectWorkspaceIsShown(page);

    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    expect(response?.headers()).toMatchObject(expectedSecurityHeaders);
    expect(response?.headers()["cache-control"]).toBe("no-store");
  });

  test("an address that does not exist carries the browser protections when signed in (FR-34)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    await expectWorkspaceIsShown(page);

    const response = await page.goto("/nope");

    expect(response?.headers()).toMatchObject(expectedSecurityHeaders);
    // The framework answers its own not-found page with a longer value that includes `no-store`.
    expect(response?.headers()["cache-control"]).toContain("no-store");
  });

  test("the public resources do not carry the page protections", async ({ page, request }) => {
    await page.goto("/sign-in");
    const staticFileAddress = await page.evaluate(
      () =>
        [...document.querySelectorAll("script[src]")]
          .map((element) => element.getAttribute("src") ?? "")
          .find((address) => address.startsWith("/_next/static/")) ?? "",
    );
    expect(staticFileAddress).not.toBe("");

    const staticFileResponse = await request.get(staticFileAddress);

    expect(staticFileResponse.status()).toBe(200);
    expect(staticFileResponse.headers()["x-frame-options"]).toBeUndefined();
  });
});
