/**
 * The examples of the spec's "Valid email" definition (spec 002), written once so the domain test
 * and the contract scenarios use exactly the same ones.
 */

const EMAIL_DOMAIN_SUFFIX = "@example.com";
const KELVIN_SIGN = "K";

/** An address of exactly `length` characters whose local part is made of plain letters. */
export function buildEmailOfLength(length: number): string {
  return `${"a".repeat(length - EMAIL_DOMAIN_SUFFIX.length)}${EMAIL_DOMAIN_SUFFIX}`;
}

/** The valid examples of the definition. */
export const VALID_EMAIL_EXAMPLES: readonly string[] = [
  "ana@example.com",
  "Ana.Maria@Example.COM",
  "x+y@example.co",
  "a_b@example.com",
  "o'brien@example.com",
  "a.b-c@sub.example.co.uk",
  "a@1.example.com",
];

/**
 * Valid emails at the edges of the rule: the longest allowed, a long domain label, an apostrophe
 * before a dot (only the end of the whole local part is restricted), a domain label that ends in a
 * hyphen and a local part that starts with a digit.
 */
export const VALID_EMAIL_BOUNDARY_EXAMPLES: readonly string[] = [
  buildEmailOfLength(254),
  `a@${"b".repeat(60)}.${"c".repeat(60)}.com`,
  "a'.b@example.com",
  "a@exam-.com",
  "1a@example.com",
];

/** The not-valid examples of the definition, except the one of 255 characters (see below). */
export const NOT_VALID_EMAIL_EXAMPLES: readonly string[] = [
  "a@localhost",
  "a@b",
  "a@example.c",
  "a@example.c0m",
  "a@192.168.0.1",
  "a@[192.168.0.1]",
  "a..b@example.com",
  ".a@example.com",
  "a.@example.com",
  "a'@example.com",
  "{a}@example.com",
  "a!b@example.com",
  "a=b@example.com",
  "a@-example.com",
  "a@example..com",
  "a@example.com.",
  "a b@example.com",
  "a@@example.com",
  "añ@example.com",
  "a@exämple.com",
  // The Kelvin sign lower-cases to a plain "k": the rule is applied before lower-casing.
  `${KELVIN_SIGN}ana@example.com`,
];

/** The not-valid example of 255 characters. It is kept apart because its shape is valid: only its length is not. */
export const TOO_LONG_EMAIL_EXAMPLE: string = buildEmailOfLength(255);
