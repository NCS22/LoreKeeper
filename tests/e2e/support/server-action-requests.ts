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
