import { ValidationError } from "@/shared/domain/validation-error";

export const CROSS_SITE_REQUEST_FIELD = "request";
export const CROSS_SITE_REQUEST_ISSUE_CODE = "CROSS_SITE_REQUEST";

/** The part of `Headers` this check needs; a plain `Headers` object satisfies it. */
export type ReadableRequestHeaders = {
  get(headerName: string): string | null;
};

/**
 * Rejects a mutating request that comes from another site (FR-30). It rejects when
 * `Sec-Fetch-Site` is present and is not `same-origin`, or when `Origin` is present and its host is
 * not the host the request was addressed to (`X-Forwarded-Host`, else `Host`). A request with
 * neither header is not a browser request and is accepted here; the `SameSite=Strict` cookie
 * covers the real attack.
 */
export function assertSameSiteRequest(requestHeaders: ReadableRequestHeaders): void {
  if (isCrossSiteRequest(requestHeaders)) {
    throw new ValidationError([
      { field: CROSS_SITE_REQUEST_FIELD, code: CROSS_SITE_REQUEST_ISSUE_CODE },
    ]);
  }
}

function isCrossSiteRequest(requestHeaders: ReadableRequestHeaders): boolean {
  const fetchSite = requestHeaders.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite.trim().toLowerCase() !== "same-origin") {
    return true;
  }

  const origin = requestHeaders.get("origin");
  if (origin === null) {
    return false;
  }
  const hostOfOrigin = readHostOfOrigin(origin);
  return (
    hostOfOrigin === null || hostOfOrigin !== readHostTheRequestWasAddressedTo(requestHeaders)
  );
}

function readHostOfOrigin(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    // An unparseable Origin (including the literal "null") cannot match any host.
    return null;
  }
}

function readHostTheRequestWasAddressedTo(requestHeaders: ReadableRequestHeaders): string | null {
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host")?.trim();
  return host ? host.toLowerCase() : null;
}
