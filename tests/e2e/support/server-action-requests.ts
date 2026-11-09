import type { Request } from "@playwright/test";

/**
 * A Server Action call is a POST that carries the `next-action` header. The tests tell the
 * sign-in call from the session confirmation by the email in its body (the confirmation has none).
 */
export function isServerActionRequest(request: Request): boolean {
  return request.method() === "POST" && request.headers()["next-action"] !== undefined;
}

export function isServerActionRequestWithText(request: Request, text: string): boolean {
  return isServerActionRequest(request) && (request.postData() ?? "").includes(text);
}

/**
 * The headers of a forged Server Action call made without a browser page. A call carries the
 * `next-action` header; its value is the identifier of an action (here one that does not exist, since
 * the guard answers before any action is looked up).
 */
export const FORGED_OPERATION_CALL_HEADERS = {
  "next-action": "0123456789abcdef",
  "content-type": "text/plain;charset=UTF-8",
};
