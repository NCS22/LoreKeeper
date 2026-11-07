import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InfrastructureError } from "@/shared/domain/error-kinds";

// The request exists (its headers are emulated) but the environment does not: the only thing
// that can fail is what is built on first use.
vi.mock("next/headers", async () =>
  (await import("../../support/emulated-next-headers")).nextHeadersModuleReplacement,
);

const BETTER_AUTH_INSTANCE_GLOBAL_KEY = Symbol.for("lorekeeper.betterAuthInstance");
const PRISMA_CLIENT_GLOBAL_KEY = Symbol.for("lorekeeper.prismaClient");

const TYPED_PASSWORD = "unique-typed-password-4f9c1a";

// Imported inside each test, after the environment is emptied, so the import itself runs without environment.
function importComposition() {
  return import("@/modules/accounts/composition");
}

function readFailure(work: Promise<unknown>): Promise<unknown> {
  return work.then(
    () => {
      throw new Error("Expected the operation to fail, but it succeeded.");
    },
    (reason: unknown) => reason,
  );
}

describe("the composition of the accounts module without environment", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    vi.stubEnv("BETTER_AUTH_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("can be imported and composed without throwing and without building anything heavy", async () => {
    const { createAccountsModule } = await importComposition();

    expect(() => createAccountsModule()).not.toThrow();

    const globalScope = globalThis as Record<symbol, unknown>;
    expect(globalScope[BETTER_AUTH_INSTANCE_GLOBAL_KEY]).toBeUndefined();
    expect(globalScope[PRISMA_CLIENT_GLOBAL_KEY]).toBeUndefined();
  });

  it("fails sign-up with the generic InfrastructureError, naming no value and not the password", async () => {
    const { createAccountsModule } = await importComposition();
    const accountsModule = createAccountsModule();

    const failure = await readFailure(
      accountsModule.signUp({
        displayName: "Ana Torres",
        email: "ana@example.com",
        password: TYPED_PASSWORD,
        repeatPassword: TYPED_PASSWORD,
      }),
    );

    expect(failure).toBeInstanceOf(InfrastructureError);
    expect((failure as InfrastructureError).message).not.toContain(TYPED_PASSWORD);
  });

  it("fails sign-in with the InfrastructureError, not with the credential error", async () => {
    const { createAccountsModule } = await importComposition();
    const accountsModule = createAccountsModule();

    const failure = await readFailure(
      accountsModule.signIn({ email: "ana@example.com", password: TYPED_PASSWORD }),
    );

    expect(failure).toBeInstanceOf(InfrastructureError);
    expect((failure as InfrastructureError).message).not.toContain(TYPED_PASSWORD);
  });

  it("fails sign-out with the InfrastructureError", async () => {
    const { createAccountsModule } = await importComposition();
    const accountsModule = createAccountsModule();

    expect(await readFailure(accountsModule.signOut())).toBeInstanceOf(InfrastructureError);
  });

  it("is exposed through the public interface of the module", async () => {
    const publicInterface = await import("@/modules/accounts");

    expect(typeof publicInterface.createAccountsModule).toBe("function");
    expect(publicInterface.MAXIMUM_ACCOUNT_PASSWORD_LENGTH).toBe(128);
  });
});
