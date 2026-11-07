/** The attributes a cookie was last written with, as `next/headers` receives them. */
export type WrittenCookieOptions = {
  readonly httpOnly?: boolean;
  readonly secure?: boolean;
  readonly sameSite?: boolean | "lax" | "strict" | "none";
  readonly maxAge?: number;
  readonly expires?: Date | number;
  readonly path?: string;
};

export type RequestCookieJar = {
  /** The `cookies()` store of Next.js: what the server reads and writes during one request. */
  readonly cookieStore: {
    get(name: string): { name: string; value: string } | undefined;
    getAll(): { name: string; value: string }[];
    set(name: string, value: string, options?: WrittenCookieOptions): void;
    delete(name: string): void;
  };
  /** The `headers()` of the next request: carries what the browser would send in `Cookie`. */
  buildRequestHeaders(): Headers;
  readCookieValue(name: string): string | null;
  readLastWrittenOptions(name: string): WrittenCookieOptions | undefined;
  /** Puts a cookie in the jar as a browser that already holds it would. */
  holdCookie(name: string, value: string): void;
  clear(): void;
};

function isDeletion(options: WrittenCookieOptions | undefined): boolean {
  if (options?.maxAge !== undefined && options.maxAge <= 0) {
    return true;
  }
  if (options?.expires !== undefined) {
    return new Date(options.expires).getTime() <= Date.now();
  }
  return false;
}

/** An emulated browser cookie jar behind the `cookies()` and `headers()` of Next.js, for tests outside a request. */
export function createRequestCookieJar(): RequestCookieJar {
  const cookieValuesByName = new Map<string, string>();
  const lastWrittenOptionsByName = new Map<string, WrittenCookieOptions>();

  return {
    cookieStore: {
      get(name) {
        const value = cookieValuesByName.get(name);
        return value === undefined ? undefined : { name, value };
      },
      getAll() {
        return [...cookieValuesByName].map(([name, value]) => ({ name, value }));
      },
      set(name, value, options) {
        lastWrittenOptionsByName.set(name, options ?? {});
        if (isDeletion(options)) {
          cookieValuesByName.delete(name);
        } else {
          cookieValuesByName.set(name, value);
        }
      },
      delete(name) {
        cookieValuesByName.delete(name);
      },
    },
    buildRequestHeaders() {
      const headers = new Headers();
      if (cookieValuesByName.size > 0) {
        headers.set(
          "cookie",
          [...cookieValuesByName].map(([name, value]) => `${name}=${value}`).join("; "),
        );
      }
      return headers;
    },
    readCookieValue: (name) => cookieValuesByName.get(name) ?? null,
    readLastWrittenOptions: (name) => lastWrittenOptionsByName.get(name),
    holdCookie(name, value) {
      cookieValuesByName.set(name, value);
    },
    clear() {
      cookieValuesByName.clear();
      lastWrittenOptionsByName.clear();
    },
  };
}
