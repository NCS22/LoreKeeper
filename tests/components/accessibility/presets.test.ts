import { describe, expect, it } from "vitest";
import {
  BACKGROUND_PRESET_IDS,
  DEFAULT_PREFERENCES,
  TEXT_PRESET_IDS,
  TEXT_SCALE_MAX_PERCENT,
  TEXT_SCALE_MIN_PERCENT,
  TEXT_SCALE_STEP_PERCENT,
} from "@/components/accessibility/presets";

describe("default preferences", () => {
  it("use existing presets and a scale inside the allowed range", () => {
    expect(BACKGROUND_PRESET_IDS).toContain(DEFAULT_PREFERENCES.background);
    expect(TEXT_PRESET_IDS).toContain(DEFAULT_PREFERENCES.text);
    expect(DEFAULT_PREFERENCES.textScalePercent).toBeGreaterThanOrEqual(TEXT_SCALE_MIN_PERCENT);
    expect(DEFAULT_PREFERENCES.textScalePercent).toBeLessThanOrEqual(TEXT_SCALE_MAX_PERCENT);
  });

  it("start on the slider grid, so the default is a reachable slider position", () => {
    const stepsFromMinimum = (DEFAULT_PREFERENCES.textScalePercent - TEXT_SCALE_MIN_PERCENT) / TEXT_SCALE_STEP_PERCENT;
    expect(Number.isInteger(stepsFromMinimum)).toBe(true);
  });
});

describe("text scale range", () => {
  it("spans a whole number of slider steps", () => {
    const stepsInRange = (TEXT_SCALE_MAX_PERCENT - TEXT_SCALE_MIN_PERCENT) / TEXT_SCALE_STEP_PERCENT;
    expect(Number.isInteger(stepsInRange)).toBe(true);
  });
});
