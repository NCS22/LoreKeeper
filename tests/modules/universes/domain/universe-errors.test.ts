import { describe, expect, it } from "vitest";
import { UniverseNotFoundError } from "@/modules/universes/domain/universe-errors";
import { NOT_FOUND_ERROR_CODE, NotFoundError } from "@/shared/domain/error-kinds";

describe("UniverseNotFoundError", () => {
  it("is a not found error with the not found code", () => {
    const error = new UniverseNotFoundError();

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.code).toBe(NOT_FOUND_ERROR_CODE);
  });

  it("always has the same message, so a foreign and a missing universe look identical", () => {
    expect(new UniverseNotFoundError().message).toBe("The universe was not found.");
  });
});
