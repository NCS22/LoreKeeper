import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { PUBLIC_RESOURCE_PATHS, classifyAddress } from "@/modules/accounts";
import { config, proxy } from "@/proxy";
import type { GuardedSessionState } from "@/shared/presentation/page-access-guard";

// Only the session reader is replaced (it needs the library instance and the database, which the
// browser tests run); the guard and the access policy the proxy wires are the real ones.
const sessionOfTheRequest = vi.hoisted(() => ({ state: "signed-out" as GuardedSessionState }));

vi.mock("@/shared/infrastructure/read-session-for-guard", () => ({
  readSessionForGuard: async () => ({ state: sessionOfTheRequest.state, setCookieLines: [] }),
}));

// The matcher of the page gate must be exactly the complement of the public resources of the
// access policy (FR-21, plan D20), matched on a path-segment boundary (decision D-T2-2).
// The installed Next.js names its testing helper `unstable_doesMiddlewareMatch`; the documentation
// of the same version calls it `unstable_doesProxyMatch`.

function proxyRunsFor(address: string): boolean {
  return unstable_doesMiddlewareMatch({ config, url: address });
}

describe("the matcher of the page gate", () => {
  it("is a function the framework can call as the proxy", () => {
    expect(typeof proxy).toBe("function");
  });

  it.each([
    "/",
    "/?x=1",
    "/sign-in",
    "/sign-up",
    "/nope",
    "/a/b?x=1&y=2",
    "/session-check-failed",
    "/_next",
    "/_next/",
    "/_next/staticfoo",
    "/_next/static-files/x.js",
    "/_next/imagefoo",
    "/_next/other/x.js",
    "/_next/Static/x.js",
    "/_next/Image",
    "/favicon.icon",
    "/favicon.ico.map",
    "/favicon.ico/x",
    "/Favicon.ico",
    "/x/favicon.ico",
    "/x/_next/static/a.js",
  ])("runs the guard for %s", (address) => {
    expect(proxyRunsFor(address)).toBe(true);
  });

  it.each([
    "/_next/static",
    "/_next/static/",
    "/_next/static/chunks/main.js",
    "/_next/static/media/font.woff2",
    "/_next/image",
    "/_next/image/",
    "/_next/image?url=%2Fa.png&w=64&q=75",
    "/favicon.ico",
    "/favicon.ico?v=2",
  ])("does not run the guard for the public resource %s", (address) => {
    expect(proxyRunsFor(address)).toBe(false);
  });

  it("agrees with the access policy for every address: it runs exactly where the policy says the address is not a public resource", () => {
    const addresses = [
      "/",
      "/sign-in",
      "/sign-up",
      "/nope",
      "/_next/static",
      "/_next/static/a.js",
      "/_next/staticfoo",
      "/_next/image",
      "/_next/image/x",
      "/_next/imagefoo",
      "/favicon.ico",
      "/favicon.icofoo",
      "/favicon.ico/x",
      "/Favicon.ico",
      "/_next/Static/a.js",
      ...PUBLIC_RESOURCE_PATHS,
      ...PUBLIC_RESOURCE_PATHS.map((publicPath) => `${publicPath}/deeper/file`),
      ...PUBLIC_RESOURCE_PATHS.map((publicPath) => `${publicPath}x`),
    ];

    for (const address of addresses) {
      const isPublicResource = classifyAddress(address) === "public-resource";
      expect(proxyRunsFor(address), address).toBe(!isPublicResource);
    }
  });

  it("excludes exactly the three public resources of the policy", () => {
    expect([...PUBLIC_RESOURCE_PATHS]).toEqual(["/_next/static", "/_next/image", "/favicon.ico"]);
  });
});

describe("the proxy with the real guard and access policy", () => {
  const SERVER_ORIGIN = "http://localhost:3000";

  function requestPage(address: string): NextRequest {
    return new NextRequest(`${SERVER_ORIGIN}${address}`, { method: "GET" });
  }

  it("redirects a signed-out request for a page to sign-in, keeping the page as the destination", async () => {
    sessionOfTheRequest.state = "signed-out";

    const response = await proxy(requestPage("/?x=1"));

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "", SERVER_ORIGIN);
    expect(`${location.pathname}${location.search}`).toBe("/sign-in?returnTo=%2F%3Fx%3D1");
  });

  it("lets a signed-in request for a page pass", async () => {
    sessionOfTheRequest.state = "signed-in";

    const response = await proxy(requestPage("/?x=1"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });
});
