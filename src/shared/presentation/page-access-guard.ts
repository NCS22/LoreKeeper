import { NextResponse, type NextRequest } from "next/server";
import {
  ACTION_REFUSAL_CONTENT_TYPE,
  SESSION_CHECK_FAILED_ACTION_REFUSAL,
  SIGNED_OUT_ACTION_REFUSAL,
} from "./signed-out-action-response";

// The guard defines the shape of what it needs from the access policy and from the session reader,
// so it imports no module: the proxy wires the accounts policy and the shared reader into it.

export type GuardedSessionState = "signed-in" | "signed-out" | "check-failed";

export type GuardedSessionReading = {
  readonly state: GuardedSessionState;
  /** Complete `Set-Cookie` values produced while reading the session (renewal or removal of a dead cookie). */
  readonly setCookieLines: readonly string[];
};

export type PageAccessQuestion = {
  readonly pathname: string;
  readonly search: string;
  readonly method: string;
  readonly isOperationCall: boolean;
  readonly sessionState: GuardedSessionState;
  readonly returnToParameter: string | null;
};

export type PageAccessAnswer =
  | { readonly kind: "pass" }
  | { readonly kind: "redirect"; readonly location: string }
  | { readonly kind: "rewrite"; readonly destinationPath: string }
  | { readonly kind: "refuse-operation-call-signed-out" }
  | { readonly kind: "refuse-operation-call-check-failed" };

export type PageAccessGuardDependencies = {
  readonly readSession: (requestHeaders: Headers) => Promise<GuardedSessionReading>;
  readonly decideAccess: (question: PageAccessQuestion) => PageAccessAnswer;
};

/** The request header the framework adds to a call to a Server Action (an "operation call"). */
const OPERATION_CALL_HEADER = "next-action";
const RETURN_DESTINATION_PARAMETER_NAME = "returnTo";
/** The parameter the framework adds to client navigations; it is never part of an address the person asked for. */
const FRAMEWORK_NAVIGATION_PARAMETER_NAME = "_rsc";
const SEE_OTHER_STATUS = 303;
const NO_STORE = "no-store";

/**
 * The glue of the page gate (FR-15, FR-18, FR-21, FR-22, FR-24, FR-27): reads the session of the
 * request, asks the access policy what to do and turns the answer into a response. Every answer
 * says `no-store` so the browser never keeps one (FR-29, D9), carries the cookie lines the reader
 * produced (FR-16, FR-17), and contains no workspace text (NFR-4): redirects have no body and the
 * refusals are fixed short texts.
 */
export async function guardPageRequest(
  request: NextRequest,
  dependencies: PageAccessGuardDependencies,
): Promise<NextResponse> {
  const session = await dependencies.readSession(request.headers);
  const answer = dependencies.decideAccess(buildQuestion(request, session.state));
  const response = buildResponse(request, answer);
  response.headers.set("cache-control", NO_STORE);
  for (const setCookieLine of session.setCookieLines) {
    response.headers.append("set-cookie", setCookieLine);
  }
  return response;
}

function buildQuestion(request: NextRequest, sessionState: GuardedSessionState): PageAccessQuestion {
  const { pathname, search, searchParams } = request.nextUrl;
  const returnToValues = searchParams.getAll(RETURN_DESTINATION_PARAMETER_NAME);
  return {
    pathname,
    search: removeFrameworkNavigationParameter(search),
    method: request.method,
    isOperationCall: request.headers.has(OPERATION_CALL_HEADER),
    sessionState,
    // A repeated parameter means there is no single destination to trust.
    returnToParameter: returnToValues.length === 1 ? returnToValues[0] : null,
  };
}

/**
 * Cuts the framework's own `_rsc` parameter out of a query and leaves every other part exactly as
 * it was written, so the destination keeps the query the person asked for, byte for byte.
 */
function removeFrameworkNavigationParameter(search: string): string {
  if (search === "") return "";
  const remainingParts = search
    .slice(1)
    .split("&")
    .filter((part) => part !== "" && part.split("=")[0] !== FRAMEWORK_NAVIGATION_PARAMETER_NAME);
  return remainingParts.length === 0 ? "" : `?${remainingParts.join("&")}`;
}

function buildResponse(request: NextRequest, answer: PageAccessAnswer): NextResponse {
  switch (answer.kind) {
    case "pass":
      return NextResponse.next();
    case "redirect":
      // The framework's proxy accepts only an absolute address here.
      return NextResponse.redirect(new URL(answer.location, request.url), SEE_OTHER_STATUS);
    case "rewrite":
      return NextResponse.rewrite(new URL(answer.destinationPath, request.url));
    case "refuse-operation-call-signed-out":
      return buildPlainTextRefusal(SIGNED_OUT_ACTION_REFUSAL);
    case "refuse-operation-call-check-failed":
      return buildPlainTextRefusal(SESSION_CHECK_FAILED_ACTION_REFUSAL);
  }
}

// The content type is set by hand and exactly: the framework's client reads the body of a failed
// answer only when the type is `text/plain` with nothing after it (plan D5).
function buildPlainTextRefusal(refusal: { readonly status: number; readonly text: string }): NextResponse {
  return new NextResponse(refusal.text, {
    status: refusal.status,
    headers: { "content-type": ACTION_REFUSAL_CONTENT_TYPE },
  });
}
