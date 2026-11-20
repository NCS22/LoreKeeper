import type { APIRequestContext } from "@playwright/test";

// What the server hands out, read the way a browser or a crawler would, for the tests that look for
// data that must never be served (spec 004: FR-36, FR-37). Test-only; the application knows nothing
// of it.

export type ServedAnswer = {
  readonly address: string;
  readonly status: number;
  readonly contentType: string;
  /** The status line, the headers and the body, so a leak in a redirect address or a cookie shows too. */
  readonly everything: Buffer;
  readonly body: Buffer;
};

const MAXIMUM_STATIC_FILES_TO_FETCH = 400;

// A static file the server serves, written in a page, in a streamed page answer or inside another
// static file (a chunk that loads a later chunk, a style sheet that names a font).
const STATIC_FILE_REFERENCE_PATTERN =
  /(?:\/_next\/)?static\/(?:chunks|media|css)\/[A-Za-z0-9_~.%\-[\]()]+?\.(?:js|css|woff2?|png|jpe?g|svg|ico|webp|avif|map)/g;

const TEXT_FILE_PATTERN = /\.(?:js|css)$/;

/** Reads an address without following redirects, so the redirect answer itself is what is examined. */
export async function readServedAnswer(
  request: APIRequestContext,
  address: string,
  extraHeaders: Readonly<Record<string, string>> = {},
): Promise<ServedAnswer> {
  const response = await request.get(address, { maxRedirects: 0, headers: extraHeaders, failOnStatusCode: false });
  const body = await response.body();
  const headerText = Object.entries(response.headers())
    .map(([headerName, headerValue]) => `${headerName}: ${headerValue}`)
    .join("\n");
  const everything = Buffer.concat([Buffer.from(`${response.status()} ${response.url()}\n${headerText}\n\n`), body]);
  return { address, status: response.status(), contentType: response.headers()["content-type"] ?? "", everything, body };
}

/** Whether the text is anywhere in what was served, in any encoding of the bytes that keeps ASCII. */
export function servedAnswerContains(answer: ServedAnswer, text: string): boolean {
  return answer.everything.includes(Buffer.from(text, "utf8"));
}

/** The static files named in the answers, as addresses of the server, without repeats. */
export function findStaticFileAddresses(answers: readonly ServedAnswer[]): string[] {
  const addresses = new Set<string>();
  for (const answer of answers) {
    for (const reference of answer.body.toString("utf8").matchAll(STATIC_FILE_REFERENCE_PATTERN)) {
      const withoutPrefix = reference[0].replace(/^\/_next\//, "");
      addresses.add(`/_next/${withoutPrefix}`);
    }
  }
  return [...addresses];
}

/**
 * Fetches every static file the answers name, then the static files those name, until no new one
 * appears (lazy chunks, fonts used by style sheets). The addresses in `extraAddresses` (for example
 * what a real browser asked for) are fetched too. A file that cannot be fetched is kept with its
 * status so a test can tell it from one that was read.
 */
export async function fetchStaticFilesNamedBy(
  request: APIRequestContext,
  pageAnswers: readonly ServedAnswer[],
  extraAddresses: readonly string[] = [],
): Promise<ServedAnswer[]> {
  const fetchedAnswers = new Map<string, ServedAnswer>();
  const pendingAddresses = [...new Set([...findStaticFileAddresses(pageAnswers), ...extraAddresses])];
  while (pendingAddresses.length > 0 && fetchedAnswers.size < MAXIMUM_STATIC_FILES_TO_FETCH) {
    const address = pendingAddresses.shift()!;
    if (fetchedAnswers.has(address)) continue;
    const staticFile = await readServedAnswer(request, address);
    fetchedAnswers.set(address, staticFile);
    if (staticFile.status === 200 && TEXT_FILE_PATTERN.test(address.split("?")[0])) {
      for (const namedAddress of findStaticFileAddresses([staticFile])) {
        if (!fetchedAnswers.has(namedAddress)) pendingAddresses.push(namedAddress);
      }
    }
  }
  return [...fetchedAnswers.values()];
}
