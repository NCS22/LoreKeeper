// The two refusals the page guard gives to a call to a Server Action (an "operation call") that
// reaches a workspace address without a valid session (specs/003-account-screens/plan.md, D5). They
// are plain-text answers with no workspace content. The text is fixed because the interface reads
// it: the framework's client throws an `Error` whose message is the body of a failed plain-text
// answer. Only constants live here, so the guard (server) and the sign-out control (browser) can
// both import the file.

/** No valid session: the operation does not run and the person is read as signed out. */
export const SIGNED_OUT_ACTION_REFUSAL = {
  status: 401,
  text: "Signed out.",
} as const;

/** The session could not be checked: the operation does not run and the person is not read as signed out. */
export const SESSION_CHECK_FAILED_ACTION_REFUSAL = {
  status: 503,
  text: "The session could not be checked.",
} as const;

/** The exact content type of both refusals; the framework's client reads the body only with this value. */
export const ACTION_REFUSAL_CONTENT_TYPE = "text/plain";
