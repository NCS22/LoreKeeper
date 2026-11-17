import type { APIRequestContext } from "@playwright/test";

// A Server Action call made without a browser page: the identifier read from a real call
// (`captureServerActionId`) and a body in the format the framework's client sends for plain values.

export type ReplayedServerActionCall = {
  readonly actionId: string;
  /** The page address the call goes to; the framework runs the action whatever page sent it. */
  readonly address: string;
  /** The values the action receives, as the browser would pass them; sent as the framework encodes plain values. */
  readonly argument?: unknown;
  /** The exact body to send, for a value that cannot be written as JSON (a lone surrogate). Wins over `argument`. */
  readonly rawBody?: string;
  /** `name=value; name=value` of the session cookies to send; none means a call without a session. */
  readonly cookieHeader?: string;
  readonly extraHeaders?: Readonly<Record<string, string>>;
};

export type ReplayedServerActionAnswer = {
  readonly status: number;
  readonly contentType: string | undefined;
  readonly body: string;
};

/** The `name=value` pairs of the cookies of a browser context, in the form of a `Cookie` header. */
export function buildCookieHeader(cookies: ReadonlyArray<{ name: string; value: string }>): string {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

export async function replayServerAction(
  request: APIRequestContext,
  call: ReplayedServerActionCall,
): Promise<ReplayedServerActionAnswer> {
  const response = await request.post(call.address, {
    headers: {
      "next-action": call.actionId,
      "content-type": "text/plain;charset=UTF-8",
      ...(call.cookieHeader === undefined ? {} : { cookie: call.cookieHeader }),
      ...call.extraHeaders,
    },
    data: call.rawBody ?? JSON.stringify([call.argument]),
    maxRedirects: 0,
  });
  return { status: response.status(), contentType: response.headers()["content-type"], body: await response.text() };
}

/**
 * The result object an action answered with (`{ ok: true, value }` or `{ ok: false, error }`), read from
 * the framework's streamed answer, or `null` when the answer holds none (a refusal such as "Signed out.").
 */
export function readActionResult(answer: ReplayedServerActionAnswer): { ok: boolean; [key: string]: unknown } | null {
  for (const line of answer.body.split("\n")) {
    const separatorPosition = line.indexOf(":");
    if (separatorPosition < 0) continue;
    try {
      const parsedLine: unknown = JSON.parse(line.slice(separatorPosition + 1));
      if (typeof parsedLine === "object" && parsedLine !== null && "ok" in parsedLine) {
        return parsedLine as { ok: boolean; [key: string]: unknown };
      }
    } catch {
      // Not every line of the stream is JSON; the one with the result is.
    }
  }
  return null;
}
