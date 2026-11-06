import { describe, expect, it } from "vitest";
import { toUniverseDto } from "@/modules/universes/application/universe-dto";
import type { Universe } from "@/modules/universes/domain/universe";

const universe: Universe = {
  id: "universe-1",
  name: "Cosmere",
  description: "A shared universe",
  mode: "AUTHOR",
  createdAt: new Date("2026-03-04T05:06:07.089Z"),
  updatedAt: new Date("2026-03-05T05:06:07.089Z"),
};

describe("toUniverseDto", () => {
  it("serializes both dates as ISO 8601 strings in UTC", () => {
    const universeDto = toUniverseDto(universe);

    expect(universeDto.createdAt).toBe("2026-03-04T05:06:07.089Z");
    expect(universeDto.updatedAt).toBe("2026-03-05T05:06:07.089Z");
  });

  it("carries exactly the universe fields and no cover image", () => {
    expect(toUniverseDto(universe)).toEqual({
      id: "universe-1",
      name: "Cosmere",
      description: "A shared universe",
      mode: "AUTHOR",
      createdAt: "2026-03-04T05:06:07.089Z",
      updatedAt: "2026-03-05T05:06:07.089Z",
    });
    expect(Object.keys(toUniverseDto(universe))).not.toContain("coverImageUrl");
  });

  it("keeps a missing description as null", () => {
    expect(toUniverseDto({ ...universe, description: null }).description).toBeNull();
  });
});
