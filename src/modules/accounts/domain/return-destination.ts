export const SIGN_IN_PATH = "/sign-in";
export const SIGN_UP_PATH = "/sign-up";
export const RETURN_DESTINATION_PARAMETER = "returnTo";
export const MAXIMUM_RETURN_DESTINATION_LENGTH = 2048;

// Public resources: exactly these three addresses (spec 003, "Public resources"). The first two are
// directories (the address itself and everything under it), the last one is a single file.
// Matching here is case-sensitive; the return rule below lower-cases the path before asking.
const PUBLIC_RESOURCE_DIRECTORY_PATHS = ["/_next/static", "/_next/image"] as const;
const PUBLIC_RESOURCE_FILE_PATH = "/favicon.ico";
export const PUBLIC_RESOURCE_PATHS = [
  ...PUBLIC_RESOURCE_DIRECTORY_PATHS,
  PUBLIC_RESOURCE_FILE_PATH,
] as const;

export function isPublicResourcePath(path: string): boolean {
  return (
    path === PUBLIC_RESOURCE_FILE_PATH ||
    PUBLIC_RESOURCE_DIRECTORY_PATHS.some(
      (directoryPath) => path === directoryPath || path.startsWith(`${directoryPath}/`),
    )
  );
}

// Control characters (C0, DELETE, C1) plus the Unicode line and paragraph separators.
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
// The same characters in percent-encoded form (the ones that fit in one byte).
const ENCODED_CONTROL_CHARACTER_PATTERN = /%(?:[01][0-9a-f]|7f)/i;
const BACKSLASH_PATTERN = /\\|%5c/i;

/**
 * The one rule that decides whether a requested return destination is safe (FR-20).
 *
 * The candidate is the text of the return parameter after the URL parser decoded it once, or the
 * path and query of the requested address. It returns the destination to use (path and query, never
 * the fragment) or `null`, in which case the caller uses the workspace root without saying anything.
 */
export function resolveReturnDestination(candidate: string | null | undefined): string | null {
  if (typeof candidate !== "string") return null;
  if (candidate.length > MAXIMUM_RETURN_DESTINATION_LENGTH) return null;

  const decodedCandidate = decodeOnce(candidate);
  if (decodedCandidate === null) return null;

  // Both forms are checked, so a double-encoded character (%250a) cannot hide behind the decoding.
  const textsToCheck = [candidate, decodedCandidate];
  if (textsToCheck.some(containsControlCharacter)) return null;
  if (textsToCheck.some((text) => BACKSLASH_PATTERN.test(text))) return null;
  if (!textsToCheck.every(startsWithSingleSlash)) return null;

  const addressWithoutFragment = cutFragment(candidate);
  const { path, query } = splitPathAndQuery(addressWithoutFragment);
  const decodedPath = decodeOnce(path);
  if (decodedPath === null) return null;

  const comparablePath = toComparablePath(decodedPath);
  if (isAccountPagePath(comparablePath) || isPublicResourcePath(comparablePath)) return null;
  if (queryCarriesReturnDestination(query)) return null;

  return query === "" ? path : `${path}?${query}`;
}

/** The sign-in page address, carrying the destination when it passes the return rule. */
export function buildSignInAddress(destination: string | null): string {
  return buildAddressWithDestination(SIGN_IN_PATH, destination);
}

/** The sign-up page address, carrying the destination when it passes the return rule. */
export function buildSignUpAddress(destination: string | null): string {
  return buildAddressWithDestination(SIGN_UP_PATH, destination);
}

// The destination is checked again here, so no caller can build an address that carries an unsafe one.
function buildAddressWithDestination(pagePath: string, destination: string | null): string {
  const safeDestination = resolveReturnDestination(destination);
  if (safeDestination === null) return pagePath;
  return `${pagePath}?${RETURN_DESTINATION_PARAMETER}=${encodeURIComponent(safeDestination)}`;
}

function decodeOnce(text: string): string | null {
  try {
    return decodeURIComponent(text);
  } catch {
    // A malformed escape sequence: the destination cannot be read, so it is not valid.
    return null;
  }
}

function containsControlCharacter(text: string): boolean {
  return CONTROL_CHARACTER_PATTERN.test(text) || ENCODED_CONTROL_CHARACTER_PATTERN.test(text);
}

function startsWithSingleSlash(text: string): boolean {
  return text.startsWith("/") && !text.startsWith("//");
}

function cutFragment(address: string): string {
  const fragmentStart = address.indexOf("#");
  return fragmentStart === -1 ? address : address.slice(0, fragmentStart);
}

function splitPathAndQuery(address: string): { path: string; query: string } {
  const queryStart = address.indexOf("?");
  if (queryStart === -1) return { path: address, query: "" };
  return { path: address.slice(0, queryStart), query: address.slice(queryStart + 1) };
}

// Lower case, dot segments resolved and empty segments (trailing or repeated slashes) removed, so
// "/Sign-In/", "/a/../sign-in" and "/%73ign-in" are all read as "/sign-in".
function toComparablePath(decodedPath: string): string {
  const segments: string[] = [];
  for (const segment of decodedPath.toLowerCase().split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join("/")}`;
}

function isAccountPagePath(comparablePath: string): boolean {
  return comparablePath === SIGN_IN_PATH || comparablePath === SIGN_UP_PATH;
}

function queryCarriesReturnDestination(query: string): boolean {
  const returnParameterName = RETURN_DESTINATION_PARAMETER.toLowerCase();
  for (const parameterName of new URLSearchParams(query).keys()) {
    if (parameterName.toLowerCase() === returnParameterName) return true;
  }
  return false;
}
