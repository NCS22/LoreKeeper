import { describe, expect, it } from "vitest";
import { ValidationError } from "@/shared/domain/validation-error";
import {
  assertSameSiteRequest,
  CROSS_SITE_REQUEST_FIELD,
  CROSS_SITE_REQUEST_ISSUE_CODE,
} from "@/shared/presentation/assert-same-site-request";

function headersOf(headerValues: Record<string, string>): Headers {
  return new Headers(headerValues);
}

function captureRejection(headerValues: Record<string, string>): unknown {
  try {
    assertSameSiteRequest(headersOf(headerValues));
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("assertSameSiteRequest", () => {
  it("accepts a request marked same-origin", () => {
    expect(() => assertSameSiteRequest(headersOf({ "sec-fetch-site": "same-origin" }))).not.toThrow();
  });

  it("accepts an origin that matches the host", () => {
    expect(() =>
      assertSameSiteRequest(headersOf({ origin: "http://localhost:3000", host: "localhost:3000" })),
    ).not.toThrow();
  });

  it("accepts an origin that matches the forwarded host behind a proxy", () => {
    expect(() =>
      assertSameSiteRequest(
        headersOf({
          origin: "https://lorekeeper.example",
          host: "internal:3000",
          "x-forwarded-host": "lorekeeper.example",
        }),
      ),
    ).not.toThrow();
  });

  it("accepts a request with no headers at all (not a browser)", () => {
    expect(() => assertSameSiteRequest(headersOf({}))).not.toThrow();
  });

  it.each(["cross-site", "same-site", "none"])("rejects Sec-Fetch-Site: %s", (fetchSite) => {
    expect(captureRejection({ "sec-fetch-site": fetchSite, host: "localhost:3000" })).toBeInstanceOf(
      ValidationError,
    );
  });

  it("rejects a foreign Origin", () => {
    expect(
      captureRejection({ origin: "https://evil.example", host: "localhost:3000" }),
    ).toBeInstanceOf(ValidationError);
  });

  it("rejects a foreign Origin even when Sec-Fetch-Site says same-origin", () => {
    expect(
      captureRejection({
        "sec-fetch-site": "same-origin",
        origin: "https://evil.example",
        host: "localhost:3000",
      }),
    ).toBeInstanceOf(ValidationError);
  });

  it("rejects an Origin on the same host name but another port", () => {
    expect(
      captureRejection({ origin: "http://localhost:4000", host: "localhost:3000" }),
    ).toBeInstanceOf(ValidationError);
  });

  it("rejects the opaque Origin 'null'", () => {
    expect(captureRejection({ origin: "null" })).toBeInstanceOf(ValidationError);
  });

  it("rejects an Origin when the request has no host to compare it with", () => {
    expect(captureRejection({ origin: "http://localhost:3000" })).toBeInstanceOf(ValidationError);
  });

  it("rejects with a validation issue on the field request and the code CROSS_SITE_REQUEST", () => {
    const rejection = captureRejection({ "sec-fetch-site": "cross-site" });

    expect(rejection).toBeInstanceOf(ValidationError);
    expect((rejection as ValidationError).issues).toEqual([
      { field: "request", code: "CROSS_SITE_REQUEST" },
    ]);
    expect(CROSS_SITE_REQUEST_FIELD).toBe("request");
    expect(CROSS_SITE_REQUEST_ISSUE_CODE).toBe("CROSS_SITE_REQUEST");
  });
});
