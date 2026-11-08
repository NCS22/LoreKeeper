import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { en } from "@/messages/en";
import { decidePageAccess } from "@/modules/accounts";
import {
  guardPageRequest,
  type GuardedSessionReading,
  type GuardedSessionState,
  type PageAccessAnswer,
  type PageAccessGuardDependencies,
  type PageAccessQuestion,
} from "@/shared/presentation/page-access-guard";
import {
  ACTION_REFUSAL_CONTENT_TYPE,
  SESSION_CHECK_FAILED_ACTION_REFUSAL,
  SIGNED_OUT_ACTION_REFUSAL,
} from "@/shared/presentation/signed-out-action-response";

const SERVER_ORIGIN = "http://localhost:3000";
const RENEWED_COOKIE_LINE =
  "better-auth.session_token=renewed-value; Path=/; Max-Age=2592000; HttpOnly; SameSite=strict";
const CLEANUP_COOKIE_LINE = "better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=strict";

// Text that only a signed-in person sees in the workspace root (NFR-4).
const WORKSPACE_TEXTS = [
  "The Ember Concordat",
  en.workspace.sidebarLabel,
  en.workspace.mainLabel,
  en.sidebar.newUniverse,
  en.center.graphView,
];

function readSessionAs(
  state: GuardedSessionState,
  setCookieLines: readonly string[] = [],
): PageAccessGuardDependencies["readSession"] {
  return async () => ({ state, setCookieLines });
}

function buildGuard(
  state: GuardedSessionState,
  setCookieLines: readonly string[] = [],
): PageAccessGuardDependencies {
  return { readSession: readSessionAs(state, setCookieLines), decideAccess: decidePageAccess };
}

function buildRequest(
  address: string,
  options: { method?: string; headers?: Record<string, string> } = {},
): NextRequest {
  return new NextRequest(`${SERVER_ORIGIN}${address}`, {
    method: options.method ?? "GET",
    headers: options.headers,
  });
}

const OPERATION_CALL_HEADERS = { "next-action": "0123456789abcdef" };

function expectNoWorkspaceText(responseText: string, response: Response): void {
  const headersText = JSON.stringify([...response.headers]);
  for (const workspaceText of WORKSPACE_TEXTS) {
    expect(responseText).not.toContain(workspaceText);
    expect(headersText).not.toContain(workspaceText);
  }
}

describe("the page access guard", () => {
  describe("a signed-out person asking for a workspace address (FR-18, FR-21, NFR-4)", () => {
    it.each(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])(
      "gets a 303 to the sign-in page with an empty body and no workspace text for %s",
      async (method) => {
        const response = await guardPageRequest(buildRequest("/", { method }), buildGuard("signed-out"));

        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toContain("/sign-in");
        expect(response.headers.get("cache-control")).toBe("no-store");
        const responseText = await response.text();
        expect(responseText).toBe("");
        expectNoWorkspaceText(responseText, response);
      },
    );

    it.each([
      ["/", "/sign-in?returnTo=%2F"],
      ["/?x=1", "/sign-in?returnTo=%2F%3Fx%3D1"],
      ["/a/b?x=1&y=2", "/sign-in?returnTo=%2Fa%2Fb%3Fx%3D1%26y%3D2"],
      ["/nope", "/sign-in?returnTo=%2Fnope"],
    ])("carries %s as the return destination of a navigation", async (address, expectedLocation) => {
      const response = await guardPageRequest(buildRequest(address), buildGuard("signed-out"));

      const location = new URL(response.headers.get("location") ?? "", SERVER_ORIGIN);
      expect(`${location.pathname}${location.search}`).toBe(expectedLocation);
    });

    it("never carries the framework's _rsc parameter into the return destination", async () => {
      const response = await guardPageRequest(buildRequest("/?x=1&_rsc=abc123"), buildGuard("signed-out"));

      const location = new URL(response.headers.get("location") ?? "", SERVER_ORIGIN);
      expect(location.search).toBe("?returnTo=%2F%3Fx%3D1");
    });

    it("drops the query entirely when _rsc is its only parameter", async () => {
      const response = await guardPageRequest(buildRequest("/?_rsc=abc123"), buildGuard("signed-out"));

      const location = new URL(response.headers.get("location") ?? "", SERVER_ORIGIN);
      expect(location.search).toBe("?returnTo=%2F");
    });

    it("carries no destination for a request that has a body (POST)", async () => {
      const response = await guardPageRequest(buildRequest("/?x=1", { method: "POST" }), buildGuard("signed-out"));

      const location = new URL(response.headers.get("location") ?? "", SERVER_ORIGIN);
      expect(`${location.pathname}${location.search}`).toBe("/sign-in");
    });

    it("sets no session cookie on the redirect when the reader produced none", async () => {
      const response = await guardPageRequest(buildRequest("/"), buildGuard("signed-out"));

      expect(response.headers.getSetCookie()).toEqual([]);
    });

    it("forwards the removal of a dead cookie on the redirect", async () => {
      const response = await guardPageRequest(
        buildRequest("/"),
        buildGuard("signed-out", [CLEANUP_COOKIE_LINE]),
      );

      expect(response.status).toBe(303);
      expect(response.headers.getSetCookie()).toEqual([CLEANUP_COOKIE_LINE]);
    });
  });

  describe("an operation call from a signed-out client (FR-21 exception, NFR-4, D5)", () => {
    it.each(["/", "/nope", "/?x=1"])(
      "to %s is refused with the 401 text, not redirected and without workspace text",
      async (address) => {
        const response = await guardPageRequest(
          buildRequest(address, { method: "POST", headers: OPERATION_CALL_HEADERS }),
          buildGuard("signed-out"),
        );

        expect(response.status).toBe(SIGNED_OUT_ACTION_REFUSAL.status);
        expect(response.headers.get("location")).toBeNull();
        expect(response.headers.get("content-type")).toBe(ACTION_REFUSAL_CONTENT_TYPE);
        expect(response.headers.get("content-type")).toBe("text/plain");
        expect(response.headers.get("cache-control")).toBe("no-store");
        const responseText = await response.text();
        expect(responseText).toBe(SIGNED_OUT_ACTION_REFUSAL.text);
        expectNoWorkspaceText(responseText, response);
      },
    );

    it("is refused whatever its method", async () => {
      for (const method of ["POST", "PUT", "GET"]) {
        const response = await guardPageRequest(
          buildRequest("/", { method, headers: OPERATION_CALL_HEADERS }),
          buildGuard("signed-out"),
        );
        expect(response.status).toBe(401);
      }
    });

    it("forwards the removal of a dead cookie on the refusal", async () => {
      const response = await guardPageRequest(
        buildRequest("/", { method: "POST", headers: OPERATION_CALL_HEADERS }),
        buildGuard("signed-out", [CLEANUP_COOKIE_LINE]),
      );

      expect(response.status).toBe(401);
      expect(response.headers.getSetCookie()).toEqual([CLEANUP_COOKIE_LINE]);
    });
  });

  describe("a session that cannot be checked (FR-24)", () => {
    it.each(["/", "/nope", "/sign-in", "/sign-up"])(
      "rewrites a page request to %s to the error page, not to sign-in",
      async (address) => {
        const response = await guardPageRequest(buildRequest(address), buildGuard("check-failed"));

        expect(response.headers.get("x-middleware-rewrite")).toBe(`${SERVER_ORIGIN}/session-check-failed`);
        expect(response.headers.get("location")).toBeNull();
        expect(response.headers.get("cache-control")).toBe("no-store");
      },
    );

    it("refuses an operation call to a workspace address with the 503 text and does not read the person as signed out", async () => {
      const response = await guardPageRequest(
        buildRequest("/", { method: "POST", headers: OPERATION_CALL_HEADERS }),
        buildGuard("check-failed"),
      );

      expect(response.status).toBe(SESSION_CHECK_FAILED_ACTION_REFUSAL.status);
      expect(response.status).toBe(503);
      expect(response.headers.get("content-type")).toBe("text/plain");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("location")).toBeNull();
      const responseText = await response.text();
      expect(responseText).toBe(SESSION_CHECK_FAILED_ACTION_REFUSAL.text);
      expect(responseText).not.toBe(SIGNED_OUT_ACTION_REFUSAL.text);
      expectNoWorkspaceText(responseText, response);
    });

    it("lets a form submission to the sign-in page through", async () => {
      const response = await guardPageRequest(
        buildRequest("/sign-in", { method: "POST", headers: OPERATION_CALL_HEADERS }),
        buildGuard("check-failed"),
      );

      expect(response.headers.get("x-middleware-next")).toBe("1");
    });
  });

  describe("a signed-in person", () => {
    it.each(["/", "/nope", "/?x=1"])("passes on %s with no-store", async (address) => {
      const response = await guardPageRequest(buildRequest(address), buildGuard("signed-in"));

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("cache-control")).toBe("no-store");
    });

    it("passes an operation call to a workspace address", async () => {
      const response = await guardPageRequest(
        buildRequest("/", { method: "POST", headers: OPERATION_CALL_HEADERS }),
        buildGuard("signed-in"),
      );

      expect(response.headers.get("x-middleware-next")).toBe("1");
    });

    it("forwards the renewed session cookie when the request passes (FR-16, FR-17)", async () => {
      const response = await guardPageRequest(buildRequest("/"), buildGuard("signed-in", [RENEWED_COOKIE_LINE]));

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.getSetCookie()).toEqual([RENEWED_COOKIE_LINE]);
    });

    it("forwards the renewed session cookie on an operation call that passes", async () => {
      const response = await guardPageRequest(
        buildRequest("/", { method: "POST", headers: OPERATION_CALL_HEADERS }),
        buildGuard("signed-in", [RENEWED_COOKIE_LINE]),
      );

      expect(response.headers.getSetCookie()).toEqual([RENEWED_COOKIE_LINE]);
    });

    it.each([
      ["/sign-in", "/"],
      ["/sign-up", "/"],
      ["/sign-in?returnTo=%2Fa%3Fx%3D1", "/a?x=1"],
      ["/sign-up?returnTo=%2F%3Fx%3D1", "/?x=1"],
      ["/sign-in?returnTo=https%3A%2F%2Fevil.example", "/"],
      ["/sign-in?returnTo=%2Fsign-in", "/"],
      ["/sign-in?returnTo=%2Fa&returnTo=%2Fb", "/"],
    ])("opening %s is redirected to %s (FR-22)", async (address, expectedDestination) => {
      const response = await guardPageRequest(
        buildRequest(address),
        buildGuard("signed-in", [RENEWED_COOKIE_LINE]),
      );

      expect(response.status).toBe(303);
      const location = new URL(response.headers.get("location") ?? "", SERVER_ORIGIN);
      expect(`${location.pathname}${location.search}`).toBe(expectedDestination);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.getSetCookie()).toEqual([RENEWED_COOKIE_LINE]);
    });

    it("lets a form submission to the sign-in page through, so the action can say already signed in (FR-22)", async () => {
      const response = await guardPageRequest(
        buildRequest("/sign-in", { method: "POST", headers: OPERATION_CALL_HEADERS }),
        buildGuard("signed-in"),
      );

      expect(response.headers.get("x-middleware-next")).toBe("1");
    });
  });

  describe("a signed-out person on the sign-in and sign-up pages (FR-1, FR-2)", () => {
    it.each(["/sign-in", "/sign-up", "/sign-in?returnTo=%2F"])("passes on %s with no-store", async (address) => {
      const response = await guardPageRequest(buildRequest(address), buildGuard("signed-out"));

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("cache-control")).toBe("no-store");
    });

    it("passes a form submission to the sign-up page", async () => {
      const response = await guardPageRequest(
        buildRequest("/sign-up", { method: "POST", headers: OPERATION_CALL_HEADERS }),
        buildGuard("signed-out"),
      );

      expect(response.headers.get("x-middleware-next")).toBe("1");
    });
  });

  describe("the glue between the reader, the policy and the response", () => {
    function recordQuestions(answer: PageAccessAnswer) {
      const questions: PageAccessQuestion[] = [];
      const dependencies: PageAccessGuardDependencies = {
        readSession: readSessionAs("signed-out"),
        decideAccess: (question) => {
          questions.push(question);
          return answer;
        },
      };
      return { questions, dependencies };
    }

    it("asks the policy with the method, the path, the query, the operation-call flag and the session state", async () => {
      const { questions, dependencies } = recordQuestions({ kind: "pass" });

      await guardPageRequest(buildRequest("/a/b?x=1&returnTo=%2Fz", { method: "post", headers: OPERATION_CALL_HEADERS }), dependencies);

      expect(questions).toEqual([
        {
          pathname: "/a/b",
          search: "?x=1&returnTo=%2Fz",
          method: "POST",
          isOperationCall: true,
          sessionState: "signed-out",
          returnToParameter: "/z",
        },
      ]);
    });

    it("tells the policy a request without the operation header is not an operation call", async () => {
      const { questions, dependencies } = recordQuestions({ kind: "pass" });

      await guardPageRequest(buildRequest("/"), dependencies);

      expect(questions[0].isOperationCall).toBe(false);
      expect(questions[0].returnToParameter).toBeNull();
    });

    it("tells the policy there is no destination when the parameter is repeated", async () => {
      const { questions, dependencies } = recordQuestions({ kind: "pass" });

      await guardPageRequest(buildRequest("/sign-in?returnTo=%2Fa&returnTo=%2Fb"), dependencies);

      expect(questions[0].returnToParameter).toBeNull();
    });

    it("asks the reader with the headers of the request", async () => {
      let receivedHeaders: Headers | undefined;
      const readSession = async (requestHeaders: Headers): Promise<GuardedSessionReading> => {
        receivedHeaders = requestHeaders;
        return { state: "signed-out", setCookieLines: [] };
      };

      await guardPageRequest(buildRequest("/", { headers: { cookie: "a=b" } }), {
        readSession,
        decideAccess: decidePageAccess,
      });

      expect(receivedHeaders?.get("cookie")).toBe("a=b");
    });

    it("keeps every cookie line, in order, on whatever response it builds", async () => {
      const lines = ["a=1; Path=/", "b=2; Path=/"];
      for (const answer of [
        { kind: "pass" },
        { kind: "redirect", location: "/sign-in" },
        { kind: "rewrite", destinationPath: "/session-check-failed" },
        { kind: "refuse-operation-call-signed-out" },
        { kind: "refuse-operation-call-check-failed" },
      ] as const satisfies readonly PageAccessAnswer[]) {
        const { dependencies } = recordQuestions(answer);
        const response = await guardPageRequest(buildRequest("/"), {
          ...dependencies,
          readSession: readSessionAs("signed-out", lines),
        });

        expect(response.headers.getSetCookie()).toEqual(lines);
        expect(response.headers.get("cache-control")).toBe("no-store");
      }
    });
  });
});
