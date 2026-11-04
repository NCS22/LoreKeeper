import * as React from "react";
import { cn } from "@/components/ui/cn";

const FIELD_CLASS_NAME = cn(
  "border-line-control bg-surface rounded-control w-full border px-2.5 text-sm",
  "placeholder:text-ink-muted transition-colors duration-(--motion-fast) ease-standard",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(FIELD_CLASS_NAME, "h-8", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(FIELD_CLASS_NAME, "min-h-24 resize-y py-1.5", className)} {...props} />;
}

export { Input, Textarea };
