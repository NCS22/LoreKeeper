import { scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  hashPasswordAsTyped,
  verifyPasswordAsTyped,
} from "@/shared/infrastructure/scrypt-password-hasher";

const COMPOSED_PASSWORD = "contraseña-á";
const DECOMPOSED_PASSWORD = "contraseña-á";
const FULLWIDTH_PASSWORD = "ｐａｓｓｗｏｒｄ１２３";
const ASCII_PASSWORD = "password123";

describe("scrypt password hasher", () => {
  it("accepts the password that was hashed", async () => {
    const hash = await hashPasswordAsTyped("correct horse");

    expect(await verifyPasswordAsTyped({ hash, password: "correct horse" })).toBe(true);
  });

  it("rejects another password", async () => {
    const hash = await hashPasswordAsTyped("correct horse");

    expect(await verifyPasswordAsTyped({ hash, password: "correct horse " })).toBe(false);
    expect(await verifyPasswordAsTyped({ hash, password: "Correct horse" })).toBe(false);
  });

  it("uses a different salt every time, so the same password gives different hashes", async () => {
    const firstHash = await hashPasswordAsTyped("correct horse");
    const secondHash = await hashPasswordAsTyped("correct horse");

    expect(firstHash).not.toBe(secondHash);
    expect(await verifyPasswordAsTyped({ hash: firstHash, password: "correct horse" })).toBe(true);
    expect(await verifyPasswordAsTyped({ hash: secondHash, password: "correct horse" })).toBe(true);
  });

  it("never contains the password in the stored text", async () => {
    const hash = await hashPasswordAsTyped("correct horse");

    expect(hash).not.toContain("correct horse");
  });

  it("treats a composed accent and a decomposed accent as different passwords", async () => {
    expect(COMPOSED_PASSWORD).not.toBe(DECOMPOSED_PASSWORD);
    const hashOfComposed = await hashPasswordAsTyped(COMPOSED_PASSWORD);
    const hashOfDecomposed = await hashPasswordAsTyped(DECOMPOSED_PASSWORD);

    expect(await verifyPasswordAsTyped({ hash: hashOfComposed, password: DECOMPOSED_PASSWORD })).toBe(
      false,
    );
    expect(await verifyPasswordAsTyped({ hash: hashOfDecomposed, password: COMPOSED_PASSWORD })).toBe(
      false,
    );
    expect(await verifyPasswordAsTyped({ hash: hashOfComposed, password: COMPOSED_PASSWORD })).toBe(
      true,
    );
  });

  it("does not fold compatibility characters such as fullwidth letters into ASCII", async () => {
    const hash = await hashPasswordAsTyped(ASCII_PASSWORD);

    expect(await verifyPasswordAsTyped({ hash, password: FULLWIDTH_PASSWORD })).toBe(false);
  });

  it("keeps leading and trailing spaces as part of the password", async () => {
    const hash = await hashPasswordAsTyped("  spaced  ");

    expect(await verifyPasswordAsTyped({ hash, password: "spaced" })).toBe(false);
    expect(await verifyPasswordAsTyped({ hash, password: "  spaced  " })).toBe(true);
  });

  it("rejects a stored value that is not a hash instead of accepting anything", async () => {
    expect(await verifyPasswordAsTyped({ hash: "", password: "correct horse" })).toBe(false);
    expect(await verifyPasswordAsTyped({ hash: "not-a-hash", password: "correct horse" })).toBe(false);
  });

  describe("stored layout: scrypt$N$r$p$salt$key", () => {
    it("writes the format name, the current cost, a 16-byte salt and a 64-byte key", async () => {
      const hash = await hashPasswordAsTyped("correct horse");

      expect(hash).toMatch(/^scrypt\$16384\$16\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    });

    it("round trips passwords typed in several scripts, exactly as typed", async () => {
      const typedPasswords = [
        "plain ASCII 123",
        COMPOSED_PASSWORD,
        DECOMPOSED_PASSWORD,
        "😀".repeat(64),
        "密码是秘密",
        "كلمة سر",
        "a\u0000b",
        "with$dollar$signs:and:colons",
      ];

      for (const typedPassword of typedPasswords) {
        const hash = await hashPasswordAsTyped(typedPassword);
        expect(await verifyPasswordAsTyped({ hash, password: typedPassword })).toBe(true);
        expect(await verifyPasswordAsTyped({ hash, password: `${typedPassword}x` })).toBe(false);
      }
    });

    it("reads the parameters from the stored text: a hash made with other parameters verifies", async () => {
      const salt = Buffer.from("0123456789abcdef0123456789abcdef", "hex");
      const key = scryptSync("other cost", salt, 32, { N: 1024, r: 8, p: 2 });
      const hash = `scrypt$1024$8$2$${salt.toString("hex")}$${key.toString("hex")}`;

      expect(await verifyPasswordAsTyped({ hash, password: "other cost" })).toBe(true);
      expect(await verifyPasswordAsTyped({ hash, password: "another cost" })).toBe(false);
    });

    it("does not accept a hash whose parameters were changed to other valid ones", async () => {
      const hash = await hashPasswordAsTyped("correct horse");
      const [name, , blockSize, parallelization, salt, key] = hash.split("$");

      for (const changedCost of ["8192", "32768"]) {
        const tamperedHash = [name, changedCost, blockSize, parallelization, salt, key].join("$");
        expect(await verifyPasswordAsTyped({ hash: tamperedHash, password: "correct horse" })).toBe(false);
      }
    });

    it("never matches when the salt or the key is altered", async () => {
      const hash = await hashPasswordAsTyped("correct horse");
      const [name, cost, blockSize, parallelization, salt, key] = hash.split("$");
      const flipFirstDigit = (hex: string) => `${hex.startsWith("0") ? "1" : "0"}${hex.slice(1)}`;

      const alteredHashes = [
        [name, cost, blockSize, parallelization, flipFirstDigit(salt ?? ""), key],
        [name, cost, blockSize, parallelization, salt, flipFirstDigit(key ?? "")],
        [name, cost, blockSize, parallelization, `${salt}00`, key],
      ].map((fields) => fields.join("$"));

      for (const alteredHash of alteredHashes) {
        expect(await verifyPasswordAsTyped({ hash: alteredHash, password: "correct horse" })).toBe(false);
      }
    });

    it("reads the key length from the stored text: a key cut short is a shorter hash and still needs the right password", async () => {
      // scrypt output is a prefix-consistent stream, so the first 63 bytes of the 64-byte key are
      // the 63-byte key of the same password. That is why the stored key length is part of the format.
      const hash = await hashPasswordAsTyped("correct horse");
      const [name, cost, blockSize, parallelization, salt, key] = hash.split("$");
      const hashWithShorterKey = [name, cost, blockSize, parallelization, salt, (key ?? "").slice(0, -2)].join("$");

      expect(await verifyPasswordAsTyped({ hash: hashWithShorterKey, password: "correct horse" })).toBe(true);
      expect(await verifyPasswordAsTyped({ hash: hashWithShorterKey, password: "correct horse!" })).toBe(false);
    });

    it("returns false, without throwing, for a salt or a key that is not hexadecimal", async () => {
      const hash = await hashPasswordAsTyped("correct horse");
      const [name, cost, blockSize, parallelization, salt, key] = hash.split("$");

      const malformedHashes = [
        [name, cost, blockSize, parallelization, "zz".repeat(16), key],
        [name, cost, blockSize, parallelization, salt, "zz".repeat(64)],
        [name, cost, blockSize, parallelization, (salt ?? "").toUpperCase(), key],
        [name, cost, blockSize, parallelization, (salt ?? "").slice(1), key],
        [name, cost, blockSize, parallelization, "", key],
        [name, cost, blockSize, parallelization, salt, ""],
      ].map((fields) => fields.join("$"));

      for (const malformedHash of malformedHashes) {
        expect(await verifyPasswordAsTyped({ hash: malformedHash, password: "correct horse" })).toBe(false);
      }
    });

    it("returns false for the wrong number of fields, another format name or a different separator", async () => {
      const hash = await hashPasswordAsTyped("correct horse");
      const [, cost, blockSize, parallelization, salt, key] = hash.split("$");

      const malformedHashes = [
        `scrypt$${cost}$${blockSize}$${parallelization}$${salt}`,
        `${hash}$extra`,
        `argon2$${cost}$${blockSize}$${parallelization}$${salt}$${key}`,
        `SCRYPT$${cost}$${blockSize}$${parallelization}$${salt}$${key}`,
        hash.replaceAll("$", ":"),
        hash.replaceAll("$", () => "$$"),
        `${hash}\n`,
        "$$$$$",
      ];

      for (const malformedHash of malformedHashes) {
        expect(await verifyPasswordAsTyped({ hash: malformedHash, password: "correct horse" })).toBe(false);
      }
    });

    it.each([
      ["a cost that is not a power of two", "scrypt$16385$16$1"],
      ["a cost of 1", "scrypt$1$16$1"],
      ["a cost of 0", "scrypt$0$16$1"],
      ["a negative cost", "scrypt$-16384$16$1"],
      ["a cost with a decimal point", "scrypt$16384.0$16$1"],
      ["an exponent cost", "scrypt$1e4$16$1"],
      ["a cost with a leading zero", "scrypt$016384$16$1"],
      ["a cost above the limit", "scrypt$131072$16$1"],
      ["an enormous cost", "scrypt$1073741824$16$1"],
      ["a cost too long to be a number", "scrypt$99999999999999999999$16$1"],
      ["a block size above the limit", "scrypt$16384$17$1"],
      ["an enormous block size", "scrypt$16384$1000000$1"],
      ["a block size of 0", "scrypt$16384$0$1"],
      ["a parallelization above the limit", "scrypt$16384$16$5"],
      ["an enormous parallelization", "scrypt$16384$16$1000000"],
      ["a parallelization of 0", "scrypt$16384$16$0"],
      ["empty parameters", "scrypt$$$"],
      ["words instead of numbers", "scrypt$high$high$high"],
    ])("returns false for %s", async (_label, parametersPart) => {
      const hash = await hashPasswordAsTyped("correct horse");
      const [, , , , salt, key] = hash.split("$");
      const hashWithOtherParameters = `${parametersPart}$${salt}$${key}`;

      expect(
        await verifyPasswordAsTyped({ hash: hashWithOtherParameters, password: "correct horse" }),
      ).toBe(false);
    });

    it("returns false for a salt or a key of a length this hasher never writes", async () => {
      const key = "ab".repeat(64);
      const tooShortSalt = "ab".repeat(7);
      const tooLongSalt = "ab".repeat(65);
      const tooShortKey = "ab".repeat(15);
      const tooLongKey = "ab".repeat(129);
      const salt = "ab".repeat(16);

      const hashes = [
        `scrypt$16384$16$1$${tooShortSalt}$${key}`,
        `scrypt$16384$16$1$${tooLongSalt}$${key}`,
        `scrypt$16384$16$1$${salt}$${tooShortKey}`,
        `scrypt$16384$16$1$${salt}$${tooLongKey}`,
      ];

      for (const hash of hashes) {
        expect(await verifyPasswordAsTyped({ hash, password: "correct horse" })).toBe(false);
      }
    });

    it("returns false at once for a huge stored value, without trying to decode it", async () => {
      const hugeHash = `scrypt$16384$16$1$${"ab".repeat(1_000_000)}$${"ab".repeat(64)}`;

      expect(await verifyPasswordAsTyped({ hash: hugeHash, password: "correct horse" })).toBe(false);
    });

    it("documents that the old salt:key layout is not accepted", async () => {
      const salt = Buffer.from("0123456789abcdef0123456789abcdef", "hex");
      const key = scryptSync("correct horse", salt, 64, { N: 16384, r: 16, p: 1, maxmem: 64 * 1024 * 1024 });
      const oldFormatHash = `${salt.toString("hex")}:${key.toString("hex")}`;

      expect(oldFormatHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
      expect(await verifyPasswordAsTyped({ hash: oldFormatHash, password: "correct horse" })).toBe(false);
    });
  });
});
