import { Check, CircleHelp, Pencil, type LucideIcon } from "lucide-react";
import { en } from "@messages/en";
import { cn } from "@/components/ui/cn";
import type { InformationStatusDto } from "@/dto/shared";

// Icon, word and border style all say the status, so it never depends on color. The border
// styles match the edge styles of the graph.
const STATUS_ICONS: Record<InformationStatusDto, LucideIcon> = {
  CONFIRMED: Check,
  USER_NOTE: Pencil,
  SPECULATION: CircleHelp,
};

const STATUS_BORDERS: Record<InformationStatusDto, string> = {
  CONFIRMED: "border-solid",
  USER_NOTE: "border-dotted",
  SPECULATION: "border-dashed",
};

export function StatusBadge({ status }: { status: InformationStatusDto }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={cn(
        "border-line-control rounded-pill text-ink-muted inline-flex items-center gap-1 border px-2 py-px text-2xs",
        STATUS_BORDERS[status],
      )}
    >
      <Icon aria-hidden className="size-3" />
      {en.statuses[status]}
    </span>
  );
}
