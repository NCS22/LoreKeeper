import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { PUBLIC_RESOURCE_PATHS, classifyAddress } from "@/modules/accounts";
import { config } from "@/proxy";
import nextConfig from "../../next.config";

// The security headers (FR-34, plan D17) and the page gate (FR-21, plan D20) leave out the same three
// public resources, and each writes the pattern on its own: `next.config.ts` and `src/proxy.ts`. This
// test keeps the two copies equal. It lives with the tooling tests because `next.config.ts` is a root
// configuration file with no counterpart in `src/`.
// Both patterns use the same address syntax, so the `source` of the headers is evaluated with the same
// installed helper as the matcher (`unstable_doesMiddlewareMatch`; the documentation of this version
// calls it `unstable_doesProxyMatch`).

const REQUIRED_SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

async function readHeaderRules() {
  if (nextConfig.headers === undefined) {
    throw new Error("next.config.ts defines no headers()");
  }
  return nextConfig.headers();
}

async function readSecurityHeaderSource(): Promise<string> {
  const headerRules = await readHeaderRules();
  expect(headerRules).toHaveLength(1);
  return headerRules[0].source;
}

function proxyRunsFor(address: string): boolean {
  return unstable_doesMiddlewareMatch({ config, url: address });
}

async function addressGetsSecurityHeaders(address: string): Promise<boolean> {
  const source = await readSecurityHeaderSource();
  return unstable_doesMiddlewareMatch({ config: { matcher: [source] }, url: address });
}

const ADDRESSES_TO_COMPARE = [
  "/",
  "/?x=1",
  "/sign-in",
  "/sign-up",
  "/session-check-failed",
  "/nope",
  "/a/b?x=1&y=2",
  "/_next",
  "/_next/",
  "/_next/static",
  "/_next/static/",
  "/_next/static/chunks/main.js",
  "/_next/static/media/font.woff2",
  "/_next/staticfoo",
  "/_next/static-files/x.js",
  "/_next/image",
  "/_next/image/",
  "/_next/image/x",
  "/_next/image?url=%2Fa.png&w=64&q=75",
  "/_next/imagefoo",
  "/_next/other/x.js",
  "/_next/Static/a.js",
  "/_next/Image",
  "/favicon.ico",
  "/favicon.ico?v=2",
  "/favicon.icox",
  "/favicon.icon",
  "/favicon.ico.map",
  "/favicon.ico/x",
  "/Favicon.ico",
  "/x/favicon.ico",
  "/x/_next/static/a.js",
  ...PUBLIC_RESOURCE_PATHS,
  ...PUBLIC_RESOURCE_PATHS.map((publicPath) => `${publicPath}/deeper/file`),
  ...PUBLIC_RESOURCE_PATHS.map((publicPath) => `${publicPath}x`),
];

describe("the security headers of next.config.ts", () => {
  it("sends exactly the three security headers", async () => {
    const headerRules = await readHeaderRules();
    expect(headerRules).toHaveLength(1);
    expect(headerRules[0].headers).toEqual(REQUIRED_SECURITY_HEADERS);
  });

  it.each(ADDRESSES_TO_COMPARE)(
    "reach %s if and only if the page gate of src/proxy.ts runs for it",
    async (address) => {
      expect(await addressGetsSecurityHeaders(address)).toBe(proxyRunsFor(address));
    },
  );

  it.each(ADDRESSES_TO_COMPARE)(
    "reach %s exactly when the access policy says it is not a public resource",
    async (address) => {
      // The policy classifies a pathname; the framework matches the pathname and ignores the query.
      const pathname = address.split("?")[0];
      const isPublicResource = classifyAddress(pathname) === "public-resource";
      expect(await addressGetsSecurityHeaders(address)).toBe(!isPublicResource);
      expect(proxyRunsFor(address)).toBe(!isPublicResource);
    },
  );

  it("leave out the three public resources, exact and nested, and nothing else near them", async () => {
    for (const publicAddress of [
      "/_next/static",
      "/_next/static/chunks/main.js",
      "/_next/image",
      "/_next/image/x",
      "/favicon.ico",
    ]) {
      expect(await addressGetsSecurityHeaders(publicAddress), publicAddress).toBe(false);
    }
    for (const nonPublicAddress of ["/_next/staticfoo", "/_next/imagefoo", "/favicon.icox", "/", "/sign-in", "/nope"]) {
      expect(await addressGetsSecurityHeaders(nonPublicAddress), nonPublicAddress).toBe(true);
    }
  });
});
