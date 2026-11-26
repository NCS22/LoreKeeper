"use client";

import { useId, type Ref } from "react";
import { en } from "@/messages/en";
import { cn } from "@/components/ui/cn";
import { UnitNumberPicker } from "@/components/knowledge/unit-number-picker";
import type { WorkDto } from "@/modules/knowledge";
import type { UniverseMode } from "@/modules/universes";

const MEDIUM_LABELS: Readonly<Record<string, string>> = en.knowledge.mediums;

const SELECT_CLASS_NAME = cn(
  "border-line-control bg-surface rounded-control h-8 w-full min-w-0 border px-2 text-sm",
  "transition-colors duration-(--motion-fast) ease-standard aria-invalid:border-danger",
);

/** A point of a work as the form holds it: the chosen work and the unit number as typed. */
export type PointValue = {
  readonly workId: string;
  readonly typedUnitNumber: string;
};

/**
 * The point proposed for a work (FR-4): its last unit while the universe is in `AUTHOR` mode, no unit
 * in `READER` mode, where the person chooses it. With no work, no point.
 */
export function proposePointForWork(work: WorkDto | undefined, universeMode: UniverseMode): PointValue {
  if (work === undefined) return { workId: "", typedUnitNumber: "" };
  return { workId: work.id, typedUnitNumber: universeMode === "AUTHOR" ? String(work.unitCount) : "" };
}

type PointFieldProps = {
  legend: string;
  works: readonly WorkDto[];
  universeMode: UniverseMode;
  value: PointValue;
  onChange: (point: PointValue) => void;
  workErrorMessage?: string;
  unitErrorMessage?: string;
  workSelectRef?: Ref<HTMLSelectElement>;
  unitInputRef?: Ref<HTMLInputElement>;
};

// A point of a work in the knowledge forms (spec 006, FR-4): a native choice of the works of the
// universe and the unit picker of the chosen work. Changing the work proposes the point of the new
// work: its last unit in `AUTHOR` mode, an empty unit in `READER` mode.
export function PointField({
  legend,
  works,
  universeMode,
  value,
  onChange,
  workErrorMessage,
  unitErrorMessage,
  workSelectRef,
  unitInputRef,
}: PointFieldProps) {
  const fieldIdPrefix = useId();
  const workSelectId = `${fieldIdPrefix}-work`;
  const workErrorId = `${fieldIdPrefix}-work-error`;
  const chosenWork = works.find((work) => work.id === value.workId);

  function chooseWork(workId: string) {
    onChange(proposePointForWork(works.find((work) => work.id === workId), universeMode));
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={workSelectId} className="text-sm font-medium">
          {en.unitPicker.workLabel}
        </label>
        <select
          id={workSelectId}
          ref={workSelectRef}
          value={value.workId}
          onChange={(event) => chooseWork(event.target.value)}
          aria-invalid={workErrorMessage !== undefined}
          aria-describedby={workErrorMessage === undefined ? undefined : workErrorId}
          className={SELECT_CLASS_NAME}
        >
          {works.map((work) => (
            <option key={work.id} value={work.id}>
              {en.unitPicker.workOption(work.title, MEDIUM_LABELS[work.medium] ?? work.medium)}
            </option>
          ))}
        </select>
        {workErrorMessage === undefined ? null : (
          <p id={workErrorId} className="text-danger text-sm">
            {workErrorMessage}
          </p>
        )}
      </div>
      {chosenWork === undefined ? null : (
        <UnitNumberPicker
          inputId={`${fieldIdPrefix}-unit`}
          inputRef={unitInputRef}
          unitWording={chosenWork.unitWording}
          unitCount={chosenWork.unitCount}
          workTitle={chosenWork.title}
          typedUnitNumber={value.typedUnitNumber}
          onTypedUnitNumberChange={(typedUnitNumber) => onChange({ workId: value.workId, typedUnitNumber })}
          serverErrorMessage={unitErrorMessage}
        />
      )}
    </fieldset>
  );
}
