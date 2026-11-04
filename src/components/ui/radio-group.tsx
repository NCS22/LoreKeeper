"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/components/ui/cn";

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid gap-2", className)} {...props} />;
}

// The item is an unstyled radio button; callers lay out its content (swatches, labels, indicator).
function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return <RadioGroupPrimitive.Item data-slot="radio-group-item" className={cn("outline-offset-2", className)} {...props} />;
}

function RadioGroupIndicator(props: React.ComponentProps<typeof RadioGroupPrimitive.Indicator>) {
  return <RadioGroupPrimitive.Indicator data-slot="radio-group-indicator" {...props} />;
}

export { RadioGroup, RadioGroupIndicator, RadioGroupItem };
