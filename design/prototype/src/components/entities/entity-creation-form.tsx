"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { en } from "@messages/en";
import { EntityTypeIcon } from "@/components/entities/entity-type-icon";
import { ENTITY_TYPE_ORDER } from "@/components/entities/entity-type-config";
import { StatusBadge } from "@/components/entities/status-badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaceState } from "@/components/workspace/workspace-state";
import { findWork, getUnitsOfWork, getWorksOfUniverse } from "@/data/queries";
import type { InformationStatusDto } from "@/dto/shared";
import type { NarrativeUnitDto } from "@/dto/work";

const STATUS_OPTIONS: readonly InformationStatusDto[] = ["CONFIRMED", "USER_NOTE", "SPECULATION"];

// Consecutive units that share a group label (a volume, a season) are offered together.
function groupUnits(units: readonly NarrativeUnitDto[]) {
  const groups: { groupLabel: string | null; units: NarrativeUnitDto[] }[] = [];
  for (const unit of units) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup !== undefined && lastGroup.groupLabel === unit.groupLabel) lastGroup.units.push(unit);
    else groups.push({ groupLabel: unit.groupLabel, units: [unit] });
  }
  return groups;
}

// A design-only form: nothing is stored and Save only explains that.
export function EntityCreationForm({ onCancel }: { onCancel: () => void }) {
  const { state } = useWorkspaceState();
  const works = getWorksOfUniverse(state.selectedUniverseId);
  const [workId, setWorkId] = useState(state.selectedWorkId ?? works[0]?.id ?? "");
  const [hasTriedToSave, setHasTriedToSave] = useState(false);
  const typeTriggerRef = useRef<HTMLButtonElement>(null);
  const fieldIdPrefix = useId();

  useEffect(() => {
    typeTriggerRef.current?.focus();
  }, []);

  const selectedWork = findWork(workId);
  const unitGroups = groupUnits(selectedWork === undefined ? [] : getUnitsOfWork(selectedWork.id));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasTriedToSave(true);
  }

  return (
    <div className="h-full overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="animate-in fade-in-0 slide-in-from-bottom-1 mx-auto flex max-w-xl flex-col gap-5 p-6 duration-(--motion-base)"
      >
        <h2 className="font-serif text-xl">{en.creation.title}</h2>

        <Field label={en.creation.typeLabel} htmlFor={`${fieldIdPrefix}-type`}>
          <Select name="type">
            <SelectTrigger id={`${fieldIdPrefix}-type`} ref={typeTriggerRef}>
              <SelectValue placeholder={en.creation.typePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPE_ORDER.map((type) => (
                <SelectItem key={type} value={type}>
                  <EntityTypeIcon type={type} />
                  {en.entityTypes[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={en.creation.nameLabel} htmlFor={`${fieldIdPrefix}-name`}>
          <Input id={`${fieldIdPrefix}-name`} name="name" autoComplete="off" placeholder={en.creation.namePlaceholder} />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{en.creation.introductionLegend}</legend>
          <p className="text-ink-muted text-xs">{en.creation.introductionHelp}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${fieldIdPrefix}-work`} className="text-xs">
                {en.creation.workLabel}
              </label>
              <Select name="work" value={workId} onValueChange={setWorkId}>
                <SelectTrigger id={`${fieldIdPrefix}-work`}>
                  <SelectValue placeholder={en.creation.workPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {works.map((work) => (
                    <SelectItem key={work.id} value={work.id}>
                      {work.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${fieldIdPrefix}-unit`} className="text-xs">
                {en.creation.unitKinds[selectedWork?.unitKind ?? "OTHER"]}
              </label>
              {/* Remounted per work so the chosen position never belongs to another work. */}
              <Select key={workId} name="unit">
                <SelectTrigger id={`${fieldIdPrefix}-unit`}>
                  <SelectValue placeholder={en.creation.unitPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {unitGroups.map((group) => (
                    <SelectGroup key={group.units[0].id}>
                      {group.groupLabel !== null && <SelectLabel>{group.groupLabel}</SelectLabel>}
                      {group.units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </fieldset>

        <Field label={en.creation.fragmentLabel} htmlFor={`${fieldIdPrefix}-fragment`} help={en.creation.fragmentHelp}>
          <Textarea id={`${fieldIdPrefix}-fragment`} name="fragment" />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{en.creation.statusLegend}</legend>
          <RadioGroup name="status" defaultValue="CONFIRMED" className="gap-1">
            {STATUS_OPTIONS.map((status) => (
              <label
                key={status}
                className="rounded-control hover:bg-hover has-[[data-state=checked]]:bg-selection flex cursor-pointer items-center gap-3 px-2 py-1.5"
              >
                <RadioGroupItem
                  value={status}
                  className="border-line-control data-[state=checked]:border-accent data-[state=checked]:bg-accent size-4 shrink-0 rounded-pill border"
                />
                <StatusBadge status={status} />
                <span className="text-ink-muted text-sm">{en.creation.statusDescriptions[status]}</span>
              </label>
            ))}
          </RadioGroup>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">{en.creation.save}</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {en.creation.cancel}
          </Button>
          <p role="status" className="text-ink-muted text-sm">
            {hasTriedToSave ? en.creation.notImplemented : null}
          </p>
        </div>
      </form>
    </div>
  );
}

type FieldProps = { label: string; htmlFor: string; help?: string; children: ReactNode };

function Field({ label, htmlFor, help, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {help !== undefined && <p className="text-ink-muted text-xs">{help}</p>}
    </div>
  );
}
