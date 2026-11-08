import { describe, expect, it } from "vitest";
import {
  SESSION_CHECK_FAILED_PATH,
  classifyAddress,
  decidePageAccess,
  type PageAccessDecision,
  type PageAccessRequest,
  type SessionState,
} from "@/modules/accounts/domain/page-access-policy";

const ALL_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
const NAVIGATION_METHODS = ["GET", "HEAD"] as const;
const OTHER_METHODS = ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
const ALL_SESSION_STATES: readonly SessionState[] = ["signed-in", "signed-out", "check-failed"];
const BOTH_KINDS_OF_REQUEST = [false, true] as const;

const PASS: PageAccessDecision = { kind: "pass" };
const REWRITE_TO_CHECK_FAILED_PAGE: PageAccessDecision = {
  kind: "rewrite",
  destinationPath: "/session-check-failed",
};

function buildRequest(overrides: Partial<PageAccessRequest>): PageAccessRequest {
  return {
    pathname: "/",
    search: "",
    method: "GET",
    isOperationCall: false,
    sessionState: "signed-out",
    returnToParameter: null,
    ...overrides,
  };
}

describe("classifyAddress", () => {
  it("recognizes the sign-in and the sign-up pages", () => {
    expect(classifyAddress("/sign-in")).toBe("sign-in-page");
    expect(classifyAddress("/sign-up")).toBe("sign-up-page");
  });

  it.each(["/_next/static", "/_next/static/chunks/main.js", "/_next/image", "/favicon.ico"])(
    "recognizes %s as a public resource",
    (pathname) => {
      expect(classifyAddress(pathname)).toBe("public-resource");
    },
  );

  it.each([
    "/",
    "/nope",
    "/universes/a",
    SESSION_CHECK_FAILED_PATH,
    // Other "/_next/..." addresses are not public
    "/_next",
    "/_next/data/build/index.json",
    "/_next/staticfoo",
    // Matching is case-sensitive and exact
    "/Sign-In",
    "/SIGN-UP",
    "/sign-in/",
    "/sign-up/x",
    "/_next/Static/x.js",
    "/_NEXT/static/x.js",
    "/Favicon.ico",
    "/favicon.ico/",
    "/x/favicon.ico",
  ])("treats %s as a workspace address", (pathname) => {
    expect(classifyAddress(pathname)).toBe("workspace-address");
  });
});

describe("decidePageAccess: public resources", () => {
  it.each(["/_next/static/chunks/main.js", "/_next/image", "/favicon.ico"])(
    "lets %s through whatever the method, the call and the session",
    (pathname) => {
      for (const method of ALL_METHODS) {
        for (const isOperationCall of BOTH_KINDS_OF_REQUEST) {
          for (const sessionState of ALL_SESSION_STATES) {
            expect(
              decidePageAccess(buildRequest({ pathname, method, isOperationCall, sessionState })),
            ).toEqual(PASS);
          }
        }
      }
    },
  );
});

describe.each(["/sign-in", "/sign-up"])("decidePageAccess: %s", (pathname) => {
  describe.each(NAVIGATION_METHODS)("%s", (method) => {
    it("lets a signed-out person through", () => {
      expect(decidePageAccess(buildRequest({ pathname, method, sessionState: "signed-out" }))).toEqual(
        PASS,
      );
    });

    it("sends a signed-in person to the workspace root when there is no destination", () => {
      expect(decidePageAccess(buildRequest({ pathname, method, sessionState: "signed-in" }))).toEqual({
        kind: "redirect",
        location: "/",
      });
    });

    it("sends a signed-in person to a valid destination, keeping its query", () => {
      const decision = decidePageAccess(
        buildRequest({
          pathname,
          method,
          sessionState: "signed-in",
          search: "?returnTo=%2Fa%3Fx%3D1",
          returnToParameter: "/a?x=1",
        }),
      );

      expect(decision).toEqual({ kind: "redirect", location: "/a?x=1" });
    });

    it.each([
      "//evil.example",
      "https://evil.example",
      "/sign-in",
      "/Sign-Up/",
      "/_next/static/x.js",
      "/a\nb",
      "",
    ])("sends a signed-in person to the root when the destination is %j", (returnToParameter) => {
      const decision = decidePageAccess(
        buildRequest({ pathname, method, sessionState: "signed-in", returnToParameter }),
      );

      expect(decision).toEqual({ kind: "redirect", location: "/" });
    });

    it("shows the error page when the session cannot be checked", () => {
      expect(
        decidePageAccess(buildRequest({ pathname, method, sessionState: "check-failed" })),
      ).toEqual(REWRITE_TO_CHECK_FAILED_PAGE);
    });

    it("accepts the method in lower case", () => {
      expect(
        decidePageAccess(
          buildRequest({ pathname, method: method.toLowerCase(), sessionState: "signed-in" }),
        ),
      ).toEqual({ kind: "redirect", location: "/" });
    });
  });

  describe.each(OTHER_METHODS)("%s (a form submission)", (method) => {
    it.each(ALL_SESSION_STATES)("lets it through when the session is %s", (sessionState) => {
      for (const isOperationCall of BOTH_KINDS_OF_REQUEST) {
        expect(
          decidePageAccess(buildRequest({ pathname, method, sessionState, isOperationCall })),
        ).toEqual(PASS);
      }
    });
  });
});

describe("decidePageAccess: workspace addresses", () => {
  const WORKSPACE_PATHNAMES = ["/", "/nope", "/universes/a", "/Sign-In", SESSION_CHECK_FAILED_PATH];

  describe("with a signed-in person", () => {
    it("lets every request through, whatever the method, the address and the call", () => {
      for (const pathname of WORKSPACE_PATHNAMES) {
        for (const method of ALL_METHODS) {
          for (const isOperationCall of BOTH_KINDS_OF_REQUEST) {
            expect(
              decidePageAccess(
                buildRequest({ pathname, method, isOperationCall, sessionState: "signed-in" }),
              ),
            ).toEqual(PASS);
          }
        }
      }
    });
  });

  describe("with a signed-out person and a request that is not an operation call", () => {
    it.each([
      ["/", "", "/sign-in?returnTo=%2F"],
      ["/", "?x=1", "/sign-in?returnTo=%2F%3Fx%3D1"],
      ["/nope", "", "/sign-in?returnTo=%2Fnope"],
      ["/a/b", "?x=1&y=2", "/sign-in?returnTo=%2Fa%2Fb%3Fx%3D1%26y%3D2"],
    ])("redirects a %s%s page request to sign-in carrying the destination", (pathname, search, location) => {
      for (const method of NAVIGATION_METHODS) {
        expect(decidePageAccess(buildRequest({ pathname, search, method }))).toEqual({
          kind: "redirect",
          location,
        });
      }
    });

    it.each(OTHER_METHODS)("redirects a %s request to sign-in without a destination", (method) => {
      expect(decidePageAccess(buildRequest({ pathname: "/", search: "?x=1", method }))).toEqual({
        kind: "redirect",
        location: "/sign-in",
      });
    });

    it.each([
      ["/Sign-In", ""],
      ["/sign-in/", ""],
      ["/", "?returnTo=%2Fa"],
      ["/", "?x=%0a"],
    ])("redirects %s%s to sign-in without a destination because the rule refuses it", (pathname, search) => {
      expect(decidePageAccess(buildRequest({ pathname, search }))).toEqual({
        kind: "redirect",
        location: "/sign-in",
      });
    });

    it("treats the error page address as any other workspace address", () => {
      expect(decidePageAccess(buildRequest({ pathname: SESSION_CHECK_FAILED_PATH }))).toEqual({
        kind: "redirect",
        location: "/sign-in?returnTo=%2Fsession-check-failed",
      });
    });

    it("never carries an address longer than the limit", () => {
      const decision = decidePageAccess(buildRequest({ pathname: `/${"a".repeat(2048)}` }));

      expect(decision).toEqual({ kind: "redirect", location: "/sign-in" });
    });
  });

  describe("with a signed-out person and an operation call", () => {
    it("refuses every method and does not redirect", () => {
      for (const pathname of WORKSPACE_PATHNAMES) {
        for (const method of ALL_METHODS) {
          expect(
            decidePageAccess(
              buildRequest({ pathname, method, isOperationCall: true, sessionState: "signed-out" }),
            ),
          ).toEqual({ kind: "refuse-operation-call-signed-out" });
        }
      }
    });
  });

  describe("when the session cannot be checked", () => {
    it("shows the error page to a request that is not an operation call, whatever the method", () => {
      for (const pathname of WORKSPACE_PATHNAMES) {
        for (const method of ALL_METHODS) {
          expect(
            decidePageAccess(buildRequest({ pathname, method, sessionState: "check-failed" })),
          ).toEqual(REWRITE_TO_CHECK_FAILED_PAGE);
        }
      }
    });

    it("refuses an operation call with a failure that does not say the person is signed out", () => {
      for (const pathname of WORKSPACE_PATHNAMES) {
        for (const method of ALL_METHODS) {
          const decision = decidePageAccess(
            buildRequest({ pathname, method, isOperationCall: true, sessionState: "check-failed" }),
          );

          expect(decision).toEqual({ kind: "refuse-operation-call-check-failed" });
          expect(decision).not.toEqual({ kind: "refuse-operation-call-signed-out" });
        }
      }
    });
  });

  it("answers the same way in the whole table whatever the letter case of the method", () => {
    expect(
      decidePageAccess(buildRequest({ pathname: "/", search: "?x=1", method: "get" })),
    ).toEqual({ kind: "redirect", location: "/sign-in?returnTo=%2F%3Fx%3D1" });
    expect(
      decidePageAccess(buildRequest({ pathname: "/", search: "?x=1", method: "head" })),
    ).toEqual({ kind: "redirect", location: "/sign-in?returnTo=%2F%3Fx%3D1" });
  });
});
