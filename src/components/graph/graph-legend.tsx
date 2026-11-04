"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { en } from "@/messages/en";
import { ENTITY_TYPE_CONFIG, ENTITY_TYPE_ORDER } from "@/components/entities/entity-type-config";
import { cn } from "@/components/ui/cn";
import { useIsDesktop } from "@/components/workspace/use-is-desktop";
import type { InformationStatusDto } from "@/mocks/dto/shared";

const STATUS_LINE_STYLES: Record<InformationStatusDto, string> = {
  CONFIRMED: "border-solid",
  USER_NOTE: "border-dotted",
  SPECULATION: "border-dashed",
};

export function GraphLegend() {
  // Open on desktop, closed on small screens where it would cover the graph, until the user chooses.
  const isDesktop = useIsDesktop();
  const [userChoice, setUserChoice] = useState<boolean | null>(null);
  const isOpen = userChoice ?? isDesktop;
  const contentId = useId();

  return (
    <div className="bg-raised border-line-control rounded-popover shadow-popover absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] border text-xs">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setUserChoice(!isOpen)}
        className="rounded-popover flex w-full items-center justify-between gap-6 px-3 py-1.5 font-medium"
      >
        {en.graph.legendTitle}
        <ChevronDown
          aria-hidden
          className={cn("size-4 transition-transform duration-(--motion-fast) ease-standard", !isOpen && "-rotate-90")}
        />
      </button>
      <div
        id={contentId}
        hidden={!isOpen}
        className="border-line grid gap-x-6 gap-y-2 border-t px-3 py-2 sm:grid-cols-[auto_auto]"
      >
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
          {ENTITY_TYPE_ORDER.map((type) => (
            <li key={type} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: `var(${ENTITY_TYPE_CONFIG[type].colorVariable})` }}
              />
              {en.entityTypes[type]}
            </li>
          ))}
        </ul>
        <ul className="flex flex-col justify-center gap-1.5">
          {(Object.keys(STATUS_LINE_STYLES) as InformationStatusDto[]).map((status) => (
            <li key={status} className="flex items-center gap-2">
              <span aria-hidden className={cn("border-ink w-7 border-t-2", STATUS_LINE_STYLES[status])} />
              {en.statuses[status]}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
