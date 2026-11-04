"use client";

import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { cn } from "@/components/ui/cn";

// Rendered as a segmented control: one joined bar, one segment pressed at a time.
function ToggleGroup({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn("border-line-control rounded-control bg-surface inline-flex border p-0.5", className)}
      {...props}
    />
  );
}

function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "rounded-control text-ink flex h-6 items-center gap-1.5 px-2.5 text-sm",
        "transition-colors duration-(--motion-fast) ease-standard hover:bg-hover",
        "data-[state=on]:bg-selection data-[state=on]:font-medium",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
