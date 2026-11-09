import { describe, expect, it } from "vitest";
import {
  MAXIMUM_RETURN_DESTINATION_LENGTH,
  PUBLIC_RESOURCE_PATHS,
  RETURN_DESTINATION_PARAMETER,
  SIGN_IN_PATH,
  SIGN_UP_PATH,
  buildSignInAddress,
  buildSignUpAddress,
  isPublicResourcePath,
  resolveReturnDestination,
} from "@/modules/accounts/domain/return-destination";

const NOT_VALID_DESTINATIONS: ReadonlyArray<readonly [string, string]> = [
  // Another site, or readable as one
  ["starts with two slashes", "//evil.example/x"],
  ["starts with a slash and a backslash", "/\\evil.example"],
  ["starts with a backslash", "\\evil.example"],
  ["starts with two backslashes", "\\\\evil.example"],
  ["an absolute address", "https://evil.example/x"],
  ["an absolute address without a scheme separator slash", "http:/evil.example"],
  ["a javascript scheme", "javascript:alert(1)"],
  ["a data scheme", "data:text/html,x"],
  ["two encoded slashes at the start", "%2f%2fevil.example"],
  ["an encoded slash after the first slash", "/%2fevil.example"],
  ["an encoded backslash at the start", "%5cevil.example"],
  ["an encoded backslash after the first slash", "/%5cevil.example"],
  ["an upper-case encoded backslash", "/%5Cevil.example"],
  ["a backslash inside the path", "/a\\b"],
  ["not starting with a slash", "a/b"],
  ["an empty text", ""],
  ["only a space before the slash", " /a"],
  ["a malformed escape sequence", "/a%zz"],
  ["a lone percent sign", "/a%"],
  ["a malformed UTF-8 escape sequence", "/%c3"],
  // Control characters, raw or encoded
  ["a raw line break", "/a\nb"],
  ["a raw carriage return", "/a\rb"],
  ["a raw tab", "/a\tb"],
  ["a raw null character", "/a\u0000b"],
  ["a raw delete character", "/a\u007fb"],
  ["a raw C1 control character", "/a\u0085b"],
  ["a raw line separator", "/a\u2028b"],
  ["a raw paragraph separator", "/a\u2029b"],
  ["an encoded line break", "/a%0ab"],
  ["an upper-case encoded line break", "/a%0Ab"],
  ["an encoded tab", "/a%09b"],
  ["an encoded null character", "/a%00b"],
  ["an encoded delete character", "/a%7fb"],
  ["a double-encoded line break", "/a%250ab"],
  ["a control character in the query", "/a?x=%0a"],
  ["a control character in the fragment", "/a#x\ny"],
  // Length
  ["2,049 characters", `/${"a".repeat(MAXIMUM_RETURN_DESTINATION_LENGTH)}`],
  // Sign-in and sign-up pages in any form
  ["the sign-in page", "/sign-in"],
  ["the sign-in page with a trailing slash", "/sign-in/"],
  ["the sign-in page with several trailing slashes", "/sign-in///"],
  ["the sign-in page with another letter case", "/Sign-In"],
  ["the sign-in page in upper case with a trailing slash", "/SIGN-IN/"],
  ["the sign-in page with a query", "/sign-in?x=1"],
  ["the sign-in page with a fragment", "/sign-in#x"],
  ["the sign-in page with an encoded letter", "/%73ign-in"],
  ["the sign-in page behind a dot segment", "/./sign-in"],
  ["the sign-in page behind a parent segment", "/a/../sign-in"],
  ["the sign-in page behind an encoded parent segment", "/a/%2e%2e/sign-in"],
  ["the sign-in page followed by a dot segment", "/sign-in/."],
  ["the sign-in page with a repeated slash before it", "/sign-in//"],
  ["the sign-up page", "/sign-up"],
  ["the sign-up page with a trailing slash", "/sign-up/"],
  ["the sign-up page with another letter case", "/Sign-Up"],
  ["the sign-up page with a query", "/sign-up?x=1"],
  // Public resources
  ["a static file", "/_next/static/chunks/main.js"],
  ["the static directory itself", "/_next/static"],
  ["a static file with another letter case", "/_next/STATIC/x.js"],
  ["an optimized image with a query", "/_next/image?url=x&w=64&q=75"],
  ["the optimized image address", "/_next/image"],
  ["the site icon", "/favicon.ico"],
  ["the site icon with another letter case", "/FAVICON.ICO"],
  ["the site icon with a trailing slash", "/favicon.ico/"],
  // A return destination of its own
  ["a query that already has a return destination", "/?returnTo=%2Fa"],
  ["a return destination among other parameters", "/a?x=1&returnTo=/b"],
  ["a return destination with another letter case", "/a?returnto=/b"],
  ["an encoded name of the return parameter", "/a?%72eturnTo=b"],
];

const VALID_DESTINATIONS: ReadonlyArray<readonly [string]> = [
  ["/"],
  ["/?x=1"],
  ["/a/b?x=1&y=2"],
  ["/a/b/"],
  ["/universes/some-universe"],
  ["/sign-in-help"],
  ["/sign-up/extra"],
  ["/_next/staticfoo"],
  ["/_nextstatic"],
  ["/favicon.icon"],
  ["/a%20b?x=%26"],
  ["/ñ?x=ü"],
  ["/a?x=1&other=returnTo-is-only-a-value"],
  [`/${"a".repeat(MAXIMUM_RETURN_DESTINATION_LENGTH - 1)}`],
];

describe("constants", () => {
  it("names the account pages, the parameter and the length limit", () => {
    expect(SIGN_IN_PATH).toBe("/sign-in");
    expect(SIGN_UP_PATH).toBe("/sign-up");
    expect(RETURN_DESTINATION_PARAMETER).toBe("returnTo");
    expect(MAXIMUM_RETURN_DESTINATION_LENGTH).toBe(2048);
  });

  it("has exactly three public resources", () => {
    expect([...PUBLIC_RESOURCE_PATHS]).toEqual(["/_next/static", "/_next/image", "/favicon.ico"]);
  });
});

describe("isPublicResourcePath", () => {
  it.each(["/_next/static", "/_next/static/a/b.js", "/_next/image", "/_next/image/x", "/favicon.ico"])(
    "accepts %s",
    (path) => {
      expect(isPublicResourcePath(path)).toBe(true);
    },
  );

  it.each([
    "/",
    "/sign-in",
    "/_next",
    "/_next/data/x.json",
    "/_next/staticfoo",
    "/_next/Static/x.js",
    "/Favicon.ico",
    "/favicon.ico/",
    "/favicon.ico/x",
    "/x/favicon.ico",
  ])("refuses %s", (path) => {
    expect(isPublicResourcePath(path)).toBe(false);
  });
});

describe("resolveReturnDestination", () => {
  it.each(NOT_VALID_DESTINATIONS)("refuses %s", (_description, candidate) => {
    expect(resolveReturnDestination(candidate)).toBeNull();
  });

  it.each(VALID_DESTINATIONS)("accepts %s and returns it unchanged", (candidate) => {
    expect(resolveReturnDestination(candidate)).toBe(candidate);
  });

  it("accepts exactly 2,048 characters and refuses 2,049", () => {
    expect(resolveReturnDestination(`/${"a".repeat(2047)}`)).not.toBeNull();
    expect(resolveReturnDestination(`/${"a".repeat(2048)}`)).toBeNull();
  });

  it.each([null, undefined])("refuses %s", (candidate) => {
    expect(resolveReturnDestination(candidate)).toBeNull();
  });

  it("refuses a value that is not text", () => {
    expect(resolveReturnDestination(42 as unknown as string)).toBeNull();
  });

  it.each([
    ["/#section", "/"],
    ["/a?x=1#section", "/a?x=1"],
    ["/a/b#", "/a/b"],
    ["/a#b#c", "/a"],
  ])("cuts the fragment of %s", (candidate, expectedDestination) => {
    expect(resolveReturnDestination(candidate)).toBe(expectedDestination);
  });

  it("keeps the query of the destination", () => {
    expect(resolveReturnDestination("/a/b?x=1&y=2#z")).toBe("/a/b?x=1&y=2");
  });

  it("drops an empty query", () => {
    expect(resolveReturnDestination("/a?")).toBe("/a");
  });

  it("does not read a fragment as part of the path", () => {
    expect(resolveReturnDestination("/#/sign-in")).toBe("/");
  });
});

describe("buildSignInAddress and buildSignUpAddress", () => {
  it("give the page address alone without a destination", () => {
    expect(buildSignInAddress(null)).toBe("/sign-in");
    expect(buildSignUpAddress(null)).toBe("/sign-up");
  });

  it("encode the destination as one parameter", () => {
    expect(buildSignInAddress("/")).toBe("/sign-in?returnTo=%2F");
    expect(buildSignUpAddress("/")).toBe("/sign-up?returnTo=%2F");
    expect(buildSignInAddress("/?x=1")).toBe("/sign-in?returnTo=%2F%3Fx%3D1");
    expect(buildSignInAddress("/a/b?x=1&y=2")).toBe("/sign-in?returnTo=%2Fa%2Fb%3Fx%3D1%26y%3D2");
  });

  it.each(["/", "/?x=1", "/a/b?x=1&y=2", "/ñ?x=ü y", "/a%20b?x=%26"])(
    "give back %s after the parameter is read once",
    (destination) => {
      const address = new URL(buildSignInAddress(destination), "http://localhost");

      expect(address.pathname).toBe("/sign-in");
      expect([...address.searchParams.keys()]).toEqual(["returnTo"]);
      expect(address.searchParams.get("returnTo")).toBe(destination);
    },
  );

  it("write only plain characters in the address", () => {
    expect(buildSignInAddress("/ñ?x=ü y")).toMatch(/^[\x21-\x7e]+$/);
  });

  it.each(["//evil.example", "/sign-in", "/Sign-Up/", "/_next/static/x.js", "/a\nb", "javascript:x"])(
    "leave out a destination that is not valid: %s",
    (destination) => {
      expect(buildSignInAddress(destination)).toBe("/sign-in");
      expect(buildSignUpAddress(destination)).toBe("/sign-up");
    },
  );

  it("cut the fragment of the destination", () => {
    expect(buildSignInAddress("/a?x=1#frag")).toBe("/sign-in?returnTo=%2Fa%3Fx%3D1");
  });

  it("produce an address whose destination passes the rule again", () => {
    const destination = "/a/b?x=1&y=2";
    const parameter = new URL(buildSignUpAddress(destination), "http://localhost").searchParams.get(
      RETURN_DESTINATION_PARAMETER,
    );

    expect(resolveReturnDestination(parameter)).toBe(destination);
  });
});
