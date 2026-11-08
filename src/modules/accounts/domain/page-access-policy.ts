import {
  SIGN_IN_PATH,
  SIGN_UP_PATH,
  buildSignInAddress,
  isPublicResourcePath,
  resolveReturnDestination,
} from "./return-destination";

/** The internal page shown when the session of a request cannot be checked (FR-24). */
export const SESSION_CHECK_FAILED_PATH = "/session-check-failed";
const WORKSPACE_ROOT_PATH = "/";

export type AddressClass = "sign-in-page" | "sign-up-page" | "public-resource" | "workspace-address";

export type SessionState = "signed-in" | "signed-out" | "check-failed";

export type PageAccessRequest = {
  /** Path of the requested address, without query or fragment. */
  readonly pathname: string;
  /** Query of the requested address including its leading "?", or an empty text. */
  readonly search: string;
  readonly method: string;
  /** True for a request that runs one of the application's operations (a Server Action call). */
  readonly isOperationCall: boolean;
  readonly sessionState: SessionState;
  /** The decoded text of the return parameter of the requested address, if it has one. */
  readonly returnToParameter: string | null;
};

export type PageAccessDecision =
  | { readonly kind: "pass" }
  | { readonly kind: "redirect"; readonly location: string }
  | { readonly kind: "rewrite"; readonly destinationPath: string }
  | { readonly kind: "refuse-operation-call-signed-out" }
  | { readonly kind: "refuse-operation-call-check-failed" };

/**
 * Which kind of address a path is. Matching is case-sensitive and exact, so "/Sign-In" and
 * "/sign-in/" are workspace addresses (the return rule then refuses them as destinations), and so is
 * every address that does not exist and every "/_next/..." address other than the two public ones.
 */
export function classifyAddress(pathname: string): AddressClass {
  if (pathname === SIGN_IN_PATH) return "sign-in-page";
  if (pathname === SIGN_UP_PATH) return "sign-up-page";
  if (isPublicResourcePath(pathname)) return "public-resource";
  return "workspace-address";
}

/** The decision table of what happens to a request, given its address and the state of its session. */
export function decidePageAccess(request: PageAccessRequest): PageAccessDecision {
  switch (classifyAddress(request.pathname)) {
    case "public-resource":
      return { kind: "pass" };
    case "sign-in-page":
    case "sign-up-page":
      return decideAccountPageAccess(request);
    case "workspace-address":
      return decideWorkspaceAccess(request);
  }
}

function decideAccountPageAccess(request: PageAccessRequest): PageAccessDecision {
  // A form submission (any other method) goes through: the action answers "already signed in" itself.
  if (!isNavigationMethod(request.method)) return { kind: "pass" };

  switch (request.sessionState) {
    case "signed-out":
      return { kind: "pass" };
    case "signed-in":
      return {
        kind: "redirect",
        location: resolveReturnDestination(request.returnToParameter) ?? WORKSPACE_ROOT_PATH,
      };
    case "check-failed":
      return rewriteToCheckFailedPage();
  }
}

function decideWorkspaceAccess(request: PageAccessRequest): PageAccessDecision {
  switch (request.sessionState) {
    case "signed-in":
      return { kind: "pass" };
    case "signed-out":
      return request.isOperationCall
        ? { kind: "refuse-operation-call-signed-out" }
        : { kind: "redirect", location: buildSignInAddress(chooseReturnDestination(request)) };
    case "check-failed":
      return request.isOperationCall
        ? { kind: "refuse-operation-call-check-failed" }
        : rewriteToCheckFailedPage();
  }
}

// The destination is carried only for requests that load a page and have no body.
function chooseReturnDestination(request: PageAccessRequest): string | null {
  if (!isNavigationMethod(request.method)) return null;
  return resolveReturnDestination(`${request.pathname}${request.search}`);
}

function isNavigationMethod(method: string): boolean {
  const normalizedMethod = method.toUpperCase();
  return normalizedMethod === "GET" || normalizedMethod === "HEAD";
}

function rewriteToCheckFailedPage(): PageAccessDecision {
  return { kind: "rewrite", destinationPath: SESSION_CHECK_FAILED_PATH };
}
