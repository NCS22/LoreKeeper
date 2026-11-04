"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "@/components/ui/cn";

type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  // Human-readable value announced by screen readers instead of the raw number.
  valueText?: string;
};

// Radix does not forward the accessible name from the root to the thumb, which is the element
// that actually has role="slider", so the name and value text are applied to the thumb here.
function Slider({
  className,
  valueText,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: SliderProps) {
  const thumbCount = props.value?.length ?? props.defaultValue?.length ?? 1;

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("relative flex h-5 w-full touch-none items-center select-none", className)}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="bg-line-control relative h-1 w-full grow rounded-pill">
        <SliderPrimitive.Range data-slot="slider-range" className="bg-primary absolute h-full rounded-pill" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }, (_, thumbIndex) => (
        <SliderPrimitive.Thumb
          key={thumbIndex}
          data-slot="slider-thumb"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-valuetext={valueText}
          className="bg-primary border-raised block size-4 rounded-pill border-2 outline-offset-2 transition-transform duration-(--motion-fast) ease-standard hover:scale-110"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
