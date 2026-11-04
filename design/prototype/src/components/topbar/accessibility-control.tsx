"use client";

import { useId, useMemo, type ReactNode } from "react";
import { Accessibility, Check, RotateCcw } from "lucide-react";
import { en } from "@messages/en";
import { MINIMUM_TEXT_CONTRAST } from "@/accessibility/contrast";
import { measureCombinationContrast } from "@/accessibility/measure-combination-contrast";
import {
  BACKGROUND_PRESET_IDS,
  DEFAULT_PREFERENCES,
  TEXT_PRESET_IDS,
  TEXT_SCALE_MAX_PERCENT,
  TEXT_SCALE_MIN_PERCENT,
  TEXT_SCALE_STEP_PERCENT,
  type BackgroundPresetId,
  type TextPresetId,
} from "@/accessibility/presets";
import { useAccessibilityPreferences } from "@/accessibility/use-accessibility-preferences";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupIndicator, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";

const SWATCH_ITEM_CLASS_NAME =
  "border-line-control rounded-control data-[state=checked]:border-accent data-[state=checked]:outline-accent flex flex-col gap-1.5 border p-1.5 text-left data-[state=checked]:outline-1 disabled:cursor-not-allowed disabled:opacity-60";

export function AccessibilityControl() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Accessibility aria-hidden />
          <span className="sr-only sm:not-sr-only">{en.accessibility.triggerLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label={en.accessibility.title}>
        <AccessibilityPanel />
      </PopoverContent>
    </Popover>
  );
}

// Mounted only while the popover is open, which is why it can safely measure colors in the DOM.
function AccessibilityPanel() {
  const { preferences, setBackground, setText, setTextScalePercent, resetPreferences } =
    useAccessibilityPreferences();

  const isCombinationReadable = useMemo(() => {
    const readableCombinations = new Set<string>();
    for (const background of BACKGROUND_PRESET_IDS) {
      for (const text of TEXT_PRESET_IDS) {
        if (measureCombinationContrast(background, text) >= MINIMUM_TEXT_CONTRAST) {
          readableCombinations.add(`${background}/${text}`);
        }
      }
    }
    return (background: BackgroundPresetId, text: TextPresetId) => readableCombinations.has(`${background}/${text}`);
  }, []);

  const hasUnavailableOption =
    BACKGROUND_PRESET_IDS.some((background) => !isCombinationReadable(background, preferences.text)) ||
    TEXT_PRESET_IDS.some((text) => !isCombinationReadable(preferences.background, text));
  const isUsingDefaults =
    preferences.background === DEFAULT_PREFERENCES.background &&
    preferences.text === DEFAULT_PREFERENCES.text &&
    preferences.textScalePercent === DEFAULT_PREFERENCES.textScalePercent;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-serif text-lg">{en.accessibility.title}</h2>

      <PanelSection label={en.accessibility.backgroundLegend}>
        {(labelId) => (
          <RadioGroup
            aria-labelledby={labelId}
            value={preferences.background}
            onValueChange={(value) => setBackground(value as BackgroundPresetId)}
            className="grid-cols-2"
          >
            {BACKGROUND_PRESET_IDS.map((background) => {
              const isReadable = isCombinationReadable(background, preferences.text);
              return (
                <RadioGroupItem
                  key={background}
                  value={background}
                  disabled={!isReadable}
                  className={SWATCH_ITEM_CLASS_NAME}
                >
                  <span
                    data-bg={background}
                    data-text={preferences.text}
                    className="bg-canvas text-ink border-line-control rounded-control flex h-9 items-center justify-between border px-2"
                  >
                    <span className="font-serif text-lg">Aa</span>
                    <span className="bg-surface border-line-control rounded-control h-4 w-6 border" />
                  </span>
                  <PresetName isReadable={isReadable}>{en.accessibility.backgroundPresets[background]}</PresetName>
                </RadioGroupItem>
              );
            })}
          </RadioGroup>
        )}
      </PanelSection>

      <PanelSection label={en.accessibility.textLegend}>
        {(labelId) => (
          <RadioGroup
            aria-labelledby={labelId}
            value={preferences.text}
            onValueChange={(value) => setText(value as TextPresetId)}
            className="grid-cols-3"
          >
            {TEXT_PRESET_IDS.map((text) => {
              const isReadable = isCombinationReadable(preferences.background, text);
              return (
                <RadioGroupItem key={text} value={text} disabled={!isReadable} className={SWATCH_ITEM_CLASS_NAME}>
                  <span
                    data-bg={preferences.background}
                    data-text={text}
                    className="bg-canvas text-ink border-line-control rounded-control flex h-9 items-center justify-center border font-serif text-lg"
                  >
                    Aa
                  </span>
                  <PresetName isReadable={isReadable}>{en.accessibility.textPresets[text]}</PresetName>
                </RadioGroupItem>
              );
            })}
          </RadioGroup>
        )}
      </PanelSection>

      <PanelSection label={en.accessibility.textSizeLabel} value={`${preferences.textScalePercent}%`}>
        {(labelId) => (
          <div className="flex items-center gap-3">
            <span aria-hidden className="text-2xs">
              A
            </span>
            <Slider
              aria-labelledby={labelId}
              valueText={`${preferences.textScalePercent}%`}
              min={TEXT_SCALE_MIN_PERCENT}
              max={TEXT_SCALE_MAX_PERCENT}
              step={TEXT_SCALE_STEP_PERCENT}
              value={[preferences.textScalePercent]}
              onValueChange={([textScalePercent]) => setTextScalePercent(textScalePercent)}
            />
            <span aria-hidden className="text-xl">
              A
            </span>
          </div>
        )}
      </PanelSection>

      {hasUnavailableOption && <p className="text-ink-muted text-xs">{en.accessibility.unavailableHint}</p>}

      <Button variant="secondary" size="sm" onClick={resetPreferences} disabled={isUsingDefaults} className="self-start">
        <RotateCcw aria-hidden />
        {en.accessibility.reset}
      </Button>
    </div>
  );
}

type PanelSectionProps = {
  label: string;
  value?: string;
  children: (labelId: string) => ReactNode;
};

function PanelSection({ label, value, children }: PanelSectionProps) {
  const labelId = useId();
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 id={labelId} className="text-sm font-medium">
          {label}
        </h3>
        {value !== undefined && <span className="text-ink-muted text-xs">{value}</span>}
      </div>
      {children(labelId)}
    </section>
  );
}

function PresetName({ isReadable, children }: { isReadable: boolean; children: ReactNode }) {
  return (
    <span className="flex items-center justify-between gap-1 text-xs">
      <span>
        {children}
        {!isReadable && <span className="sr-only"> {en.accessibility.lowContrast}</span>}
      </span>
      <RadioGroupIndicator>
        <Check aria-hidden className="text-accent size-3.5" />
      </RadioGroupIndicator>
    </span>
  );
}
