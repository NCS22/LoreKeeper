import { createRequestCookieJar } from "./request-cookie-jar";

/**
 * The browser of the test: the one cookie jar behind the emulated `next/headers`. A test file
 * replaces the module with `vi.mock("next/headers", () => import("<path>/emulated-next-headers").then(...))`
 * (see `nextHeadersModuleReplacement`) and then reads and writes cookies through this jar.
 */
export const emulatedBrowser = createRequestCookieJar();

// Headers a browser would add besides the cookies (`Origin`, `Host`, `Sec-Fetch-Site`...). Empty by default,
// which is what a request that is not from a browser looks like.
const additionalRequestHeaders = new Headers();

/** Makes every following emulated request carry this header, as a browser would send it. */
export function setEmulatedRequestHeader(headerName: string, headerValue: string): void {
  additionalRequestHeaders.set(headerName, headerValue);
}

/** Removes every header added with `setEmulatedRequestHeader`. */
export function clearEmulatedRequestHeaders(): void {
  for (const [headerName] of [...additionalRequestHeaders]) {
    additionalRequestHeaders.delete(headerName);
  }
}

function buildEmulatedRequestHeaders(): Headers {
  const requestHeaders = emulatedBrowser.buildRequestHeaders();
  for (const [headerName, headerValue] of additionalRequestHeaders) {
    requestHeaders.set(headerName, headerValue);
  }
  return requestHeaders;
}

/** The part of `next/headers` that the application and the Better Auth cookie plugin use. */
export const nextHeadersModuleReplacement = {
  cookies: async () => emulatedBrowser.cookieStore,
  headers: async () => buildEmulatedRequestHeaders(),
};
