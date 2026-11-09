import type { Response } from "@playwright/test";

/** One `Set-Cookie` line taken apart. Attribute names are lower case; flags have the value `true`. */
export type ParsedSetCookie = {
  readonly name: string;
  readonly value: string;
  readonly attributes: ReadonlyMap<string, string | true>;
};

export const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;

/** Every `Set-Cookie` line of the response, one entry per cookie (the browser may join them with a line break). */
export async function readSetCookieLines(response: Response): Promise<string[]> {
  const headers = await response.headersArray();
  return headers
    .filter((header) => header.name.toLowerCase() === "set-cookie")
    .flatMap((header) => header.value.split("\n"))
    .filter((line) => line.trim() !== "");
}

export function parseSetCookieLine(line: string): ParsedSetCookie {
  const [nameAndValue, ...attributeTexts] = line.split(";").map((part) => part.trim());
  const separatorIndex = nameAndValue.indexOf("=");
  const attributes = new Map<string, string | true>();
  for (const attributeText of attributeTexts) {
    const attributeSeparatorIndex = attributeText.indexOf("=");
    if (attributeSeparatorIndex === -1) {
      attributes.set(attributeText.toLowerCase(), true);
    } else {
      attributes.set(
        attributeText.slice(0, attributeSeparatorIndex).toLowerCase(),
        attributeText.slice(attributeSeparatorIndex + 1),
      );
    }
  }
  return {
    name: nameAndValue.slice(0, separatorIndex),
    value: nameAndValue.slice(separatorIndex + 1),
    attributes,
  };
}

/** The session cookies among the lines (Better Auth names its session cookie `...session_token`). */
export async function readSessionSetCookies(response: Response): Promise<ParsedSetCookie[]> {
  const lines = await readSetCookieLines(response);
  return lines.map(parseSetCookieLine).filter((cookie) => cookie.name.endsWith("session_token"));
}
