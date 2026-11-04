"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { cn } from "@/components/ui/cn";

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root {...props} />;
}

type SheetContentProps = React.ComponentProps<typeof SheetPrimitive.Content> & {
  side: "left" | "right";
  // Read by screen readers when the drawer opens; not shown.
  title: string;
};

function SheetContent({ side, title, className, children, ...props }: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className={cn(
          "bg-canvas/80 fixed inset-0 z-40 duration-(--motion-base)",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        )}
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        aria-describedby={undefined}
        className={cn(
          "bg-surface border-line-control shadow-popover fixed inset-y-0 z-50 flex w-[min(22rem,88vw)] flex-col outline-none",
          "duration-(--motion-base) data-[state=closed]:animate-out data-[state=open]:animate-in",
          side === "left"
            ? "data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left left-0 border-r"
            : "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right right-0 border-l",
          className,
        )}
        {...props}
      >
        <SheetPrimitive.Title className="sr-only">{title}</SheetPrimitive.Title>
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export { Sheet, SheetContent };
