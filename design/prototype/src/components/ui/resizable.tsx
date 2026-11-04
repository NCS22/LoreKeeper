"use client";

import * as ResizablePrimitive from "react-resizable-panels";
import { cn } from "@/components/ui/cn";

function ResizablePanelGroup({ className, ...props }: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full", className)}
      {...props}
    />
  );
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({ className, ...props }: ResizablePrimitive.SeparatorProps) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "bg-line relative w-px shrink-0 transition-colors duration-(--motion-fast) ease-standard",
        "after:absolute after:inset-y-0 after:-right-1 after:-left-1",
        "data-[separator=hover]:bg-accent data-[separator=active]:bg-accent",
        "focus-visible:bg-accent focus-visible:outline-offset-0",
        className,
      )}
      {...props}
    />
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
