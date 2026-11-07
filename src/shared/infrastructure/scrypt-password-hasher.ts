import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Why this exists instead of the hasher that ships with Better Auth: that one applies Unicode
// compatibility normalization (NFKC) to the password before hashing, so a composed accent and its
// decomposed form, or a fullwidth letter and its ASCII twin, would be the same password. The
// product rule (FR-8) keeps the password exactly as typed. Plan decision D10.

// Stored layout, six fields separated by `$`:
//
//   scrypt$<N>$<r>$<p>$<salt hex>$<key hex>
//
// `N`, `r` and `p` are the scrypt cost parameters in decimal; the salt and the derived key are
// lowercase hexadecimal. The key length is the length of the key field, so nothing about the cost
// is implied by the code: `verify` reads it all from the stored text, and the cost used for NEW
// hashes can be raised later without invalidating the hashes already stored.
const HASH_FORMAT_NAME = "scrypt";
const HASH_FIELD_SEPARATOR = "$";
const HASH_FIELD_COUNT = 6;

// Cost used for new hashes. Same as Better Auth's own defaults.
const NEW_HASH_COST = 16384;
const NEW_HASH_BLOCK_SIZE = 16;
const NEW_HASH_PARALLELIZATION = 1;
const NEW_HASH_KEY_BYTES = 64;
const NEW_HASH_SALT_BYTES = 16;

// Limits for the values READ from a stored hash. A corrupt or hostile value must not make the
// server allocate gigabytes or spin for minutes, so verification refuses anything beyond these.
// Memory needed is about 128 * N * r bytes and time grows with N * r * p. The limits leave room
// to quadruple the memory and the time of the current cost (N up to 65536 with r = 16 needs
// 128 MiB), and no more.
const MAXIMUM_COST = 65536;
const MAXIMUM_BLOCK_SIZE = 16;
const MAXIMUM_PARALLELIZATION = 4;
// A salt or key shorter than these is not something this hasher ever wrote; the maximums only
// bound the work of decoding and comparing.
const MINIMUM_SALT_BYTES = 8;
const MAXIMUM_SALT_BYTES = 64;
const MINIMUM_KEY_BYTES = 16;
const MAXIMUM_KEY_BYTES = 128;
// Longest text that can pass the limits above (name, three 7-digit numbers, hex salt and key, six
// fields); anything longer is refused before it is split.
const MAXIMUM_STORED_HASH_LENGTH = 512;

const DECIMAL_NUMBER_PATTERN = /^[1-9][0-9]{0,6}$/;
const HEXADECIMAL_PATTERN = /^(?:[0-9a-f]{2})+$/;

type ScryptSettings = {
  readonly cost: number;
  readonly blockSize: number;
  readonly parallelization: number;
};

type StoredHash = ScryptSettings & {
  readonly salt: Buffer;
  readonly key: Buffer;
};

function deriveKey(
  password: string,
  salt: Buffer,
  keyBytes: number,
  settings: ScryptSettings,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyBytes,
      {
        N: settings.cost,
        r: settings.blockSize,
        p: settings.parallelization,
        // Twice the memory the algorithm needs, which is what Node asks for as a minimum.
        maxmem: 128 * settings.cost * settings.blockSize * 2,
      },
      (failure, derivedKey) => {
        if (failure) {
          reject(failure);
        } else {
          resolve(derivedKey);
        }
      },
    );
  });
}

/**
 * Hashes the password exactly as typed, with a new random salt. The result is
 * `scrypt$N$r$p$salt$key` (decimal parameters, hexadecimal salt and key).
 */
export async function hashPasswordAsTyped(password: string): Promise<string> {
  const salt = randomBytes(NEW_HASH_SALT_BYTES);
  const settings: ScryptSettings = {
    cost: NEW_HASH_COST,
    blockSize: NEW_HASH_BLOCK_SIZE,
    parallelization: NEW_HASH_PARALLELIZATION,
  };
  const derivedKey = await deriveKey(password, salt, NEW_HASH_KEY_BYTES, settings);
  return [
    HASH_FORMAT_NAME,
    settings.cost,
    settings.blockSize,
    settings.parallelization,
    salt.toString("hex"),
    derivedKey.toString("hex"),
  ].join(HASH_FIELD_SEPARATOR);
}

/**
 * Checks the password, exactly as typed, against a hash made by `hashPasswordAsTyped`, using the
 * cost parameters written in the hash itself. A stored value that is not such a hash, including the
 * old `salt:key` layout and any hash whose parameters are beyond the limits above, never matches
 * and never throws.
 */
export async function verifyPasswordAsTyped(credential: {
  readonly hash: string;
  readonly password: string;
}): Promise<boolean> {
  const storedHash = parseStoredHash(credential.hash);
  if (storedHash === null) {
    return false;
  }

  const derivedKey = await deriveKey(
    credential.password,
    storedHash.salt,
    storedHash.key.length,
    storedHash,
  );
  // Both keys have the length written in the stored hash, so the comparison is always legal.
  return timingSafeEqual(derivedKey, storedHash.key);
}

function parseStoredHash(storedText: string): StoredHash | null {
  if (storedText.length > MAXIMUM_STORED_HASH_LENGTH) {
    return null;
  }
  const fields = storedText.split(HASH_FIELD_SEPARATOR);
  if (fields.length !== HASH_FIELD_COUNT || fields[0] !== HASH_FORMAT_NAME) {
    return null;
  }
  const [, costText, blockSizeText, parallelizationText, saltHex, keyHex] = fields;

  const cost = readBoundedNumber(costText, MAXIMUM_COST);
  const blockSize = readBoundedNumber(blockSizeText, MAXIMUM_BLOCK_SIZE);
  const parallelization = readBoundedNumber(parallelizationText, MAXIMUM_PARALLELIZATION);
  const salt = readBoundedHexadecimal(saltHex, MINIMUM_SALT_BYTES, MAXIMUM_SALT_BYTES);
  const key = readBoundedHexadecimal(keyHex, MINIMUM_KEY_BYTES, MAXIMUM_KEY_BYTES);
  if (
    cost === null ||
    blockSize === null ||
    parallelization === null ||
    salt === null ||
    key === null ||
    !isPowerOfTwoGreaterThanOne(cost)
  ) {
    return null;
  }
  return { cost, blockSize, parallelization, salt, key };
}

function readBoundedNumber(text: string | undefined, maximum: number): number | null {
  if (text === undefined || !DECIMAL_NUMBER_PATTERN.test(text)) {
    return null;
  }
  const value = Number(text);
  return value <= maximum ? value : null;
}

function readBoundedHexadecimal(
  text: string | undefined,
  minimumBytes: number,
  maximumBytes: number,
): Buffer | null {
  if (text === undefined || !HEXADECIMAL_PATTERN.test(text)) {
    return null;
  }
  const bytes = Buffer.from(text, "hex");
  return bytes.length >= minimumBytes && bytes.length <= maximumBytes ? bytes : null;
}

// scrypt requires its cost to be a power of two (and Node refuses anything else with an exception).
function isPowerOfTwoGreaterThanOne(value: number): boolean {
  return value > 1 && (value & (value - 1)) === 0;
}
