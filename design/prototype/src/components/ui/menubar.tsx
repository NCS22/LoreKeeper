"use client";

import * as React from "react";
import { Menubar as MenubarPrimitive } from "radix-ui";
import { cn } from "@/components/ui/cn";

function Menubar({ className, ...props }: React.ComponentProps<typeof MenubarPrimitive.Root>) {
  return (
    <MenubarPrimitive.Root
      data-slot="menubar"
      className={cn("flex items-center gap-0.5", className)}
      {...props}
    />
  );
}

function MenubarMenu(props: React.ComponentProps<typeof MenubarPrimitive.Menu>) {
  return <MenubarPrimitive.Menu {...props} />;
}

function MenubarTrigger({ className, ...props }: React.ComponentProps<typeof MenubarPrimitive.Trigger>) {
  return (
    <MenubarPrimitive.Trigger
      data-slot="menubar-trigger"
      className={cn(
        "rounded-control text-ink flex h-7 items-center px-2.5 text-sm select-none",
        "transition-colors duration-(--motion-fast) ease-standard",
        "hover:bg-hover data-[state=open]:bg-hover",
        "focus-visible:-outline-offset-2",
        className,
      )}
      {...props}
    />
  );
}

function MenubarContent({
  className,
  align = "start",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Content>) {
  return (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.Content
        data-slot="menubar-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground border-line-control rounded-popover shadow-popover z-50 min-w-56 border p-1",
          "duration-(--motion-fast) data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          className,
        )}
        {...props}
      />
    </MenubarPrimitive.Portal>
  );
}

function MenubarItem({ className, ...props }: React.ComponentProps<typeof MenubarPrimitive.Item>) {
  return (
    <MenubarPrimitive.Item
      data-slot="menubar-item"
      className={cn(
        "rounded-control flex items-center px-2 py-1.5 text-sm select-none focus-visible:-outline-offset-2",
        "data-[highlighted]:bg-hover data-[disabled]:text-ink-muted data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

function MenubarLabel({ className, ...props }: React.ComponentProps<typeof MenubarPrimitive.Label>) {
  return (
    <MenubarPrimitive.Label
      data-slot="menubar-label"
      className={cn("text-ink-muted px-2 py-1.5 text-xs", className)}
      {...props}
    />
  );
}

function MenubarSeparator({ className, ...props }: React.ComponentProps<typeof MenubarPrimitive.Separator>) {
  return (
    <MenubarPrimitive.Separator
      data-slot="menubar-separator"
      className={cn("bg-line -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

export { Menubar, MenubarContent, MenubarItem, MenubarLabel, MenubarMenu, MenubarSeparator, MenubarTrigger };
